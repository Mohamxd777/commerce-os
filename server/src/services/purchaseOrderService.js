import { pool } from '../config/database.js';
import { paginationMetadata } from '../models/catalogModelHelpers.js';
import * as goodsReceiptModel from '../models/goodsReceiptModel.js';
import * as purchaseOrderModel from '../models/purchaseOrderModel.js';
import * as supplierModel from '../models/supplierModel.js';
import { AppError } from '../utils/AppError.js';
import { translatePurchasingError } from './purchasingErrors.js';

async function validatePurchaseOrderItems(
  database,
  { organizationId, supplierId, currency, items },
) {
  const skuIds = new Set();
  for (const item of items) {
    if (skuIds.has(item.skuId)) {
      throw new AppError(400, 'DUPLICATE_PO_SKU', 'A SKU may appear only once on a purchase order.');
    }
    skuIds.add(item.skuId);

    const reference = await purchaseOrderModel.findPurchasingLineReference(database, {
      organizationId,
      supplierId,
      skuId: item.skuId,
      supplierProductId: item.supplierProductId,
    });
    if (!reference) {
      throw new AppError(
        400,
        'INVALID_PO_ITEM_REFERENCE',
        'A PO line references a SKU or supplier relationship outside this organization.',
      );
    }
    if (!reference.sku_is_active) {
      throw new AppError(409, 'SKU_INACTIVE', 'Inactive SKUs cannot be added to a new purchase order.');
    }
    if (item.supplierProductId) {
      if (!reference.supplier_product_id || !reference.supplier_product_is_active) {
        throw new AppError(
          409,
          'SUPPLIER_PRODUCT_INACTIVE',
          'The selected supplier relationship is not active.',
        );
      }
      if (reference.currency !== currency) {
        throw new AppError(
          400,
          'SUPPLIER_PRICE_CURRENCY_MISMATCH',
          'Supplier-product currency must match the purchase-order currency.',
        );
      }
      const minimumResult = await database.query(
        'SELECT $1::numeric >= $2::numeric AS allowed',
        [item.quantityOrdered, reference.moq],
      );
      if (!minimumResult.rows[0].allowed) {
        throw new AppError(
          400,
          'MOQ_NOT_MET',
          'The ordered quantity is below the supplier minimum order quantity.',
        );
      }
    }
  }
}

async function createItems(database, { organizationId, purchaseOrderId, items }) {
  for (const item of items) {
    await purchaseOrderModel.createPurchaseOrderItem(database, {
      organizationId,
      purchaseOrderId,
      ...item,
    });
  }
}

function databaseDate(value) {
  if (value === null || value === undefined) return null;
  return value instanceof Date
    ? value.toISOString().slice(0, 10)
    : String(value).slice(0, 10);
}

export async function listPurchaseOrders(organizationId, query) {
  const result = await purchaseOrderModel.listPurchaseOrders(pool, {
    organizationId,
    ...query,
  });
  return {
    items: result.rows,
    pagination: paginationMetadata(result.total, query.page, query.limit),
  };
}

export async function getPurchaseOrder(organizationId, id) {
  const purchaseOrder = await purchaseOrderModel.findPurchaseOrderById(pool, {
    organizationId,
    id,
  });
  if (!purchaseOrder) {
    throw new AppError(404, 'PURCHASE_ORDER_NOT_FOUND', 'Purchase order not found.');
  }
  const [items, receipts] = await Promise.all([
    purchaseOrderModel.listPurchaseOrderItems(pool, {
      organizationId,
      purchaseOrderId: id,
    }),
    goodsReceiptModel.listReceiptsForPurchaseOrder(pool, {
      organizationId,
      purchaseOrderId: id,
    }),
  ]);
  return { ...purchaseOrder, items, receipts };
}

export async function createPurchaseOrder(organizationId, userId, input) {
  const database = await pool.connect();
  try {
    await database.query('BEGIN');
    const supplier = await supplierModel.findSupplierById(database, {
      organizationId,
      id: input.supplierId,
    });
    if (!supplier) {
      throw new AppError(400, 'SUPPLIER_NOT_FOUND', 'Supplier not found in this organization.');
    }
    if (!supplier.is_active) {
      throw new AppError(409, 'SUPPLIER_INACTIVE', 'Reactivate the supplier before creating a PO.');
    }
    await validatePurchaseOrderItems(database, {
      organizationId,
      supplierId: input.supplierId,
      currency: input.currency,
      items: input.items,
    });

    const purchaseOrder = await purchaseOrderModel.createPurchaseOrder(database, {
      organizationId,
      createdBy: userId,
      ...input,
    });
    await createItems(database, {
      organizationId,
      purchaseOrderId: purchaseOrder.id,
      items: input.items,
    });
    await purchaseOrderModel.recalculatePurchaseOrder(database, {
      organizationId,
      id: purchaseOrder.id,
    });
    await database.query('COMMIT');
    return getPurchaseOrder(organizationId, purchaseOrder.id);
  } catch (error) {
    await database.query('ROLLBACK');
    throw translatePurchasingError(error);
  } finally {
    database.release();
  }
}

export async function patchPurchaseOrder(organizationId, id, input) {
  const database = await pool.connect();
  try {
    await database.query('BEGIN');
    const existing = await purchaseOrderModel.findPurchaseOrderById(database, {
      organizationId,
      id,
      forUpdate: true,
    });
    if (!existing) {
      throw new AppError(404, 'PURCHASE_ORDER_NOT_FOUND', 'Purchase order not found.');
    }

    const submittedFields = Object.keys(input);
    if (existing.status === 'approved' || existing.status === 'ordered') {
      const allowed = new Set(['expectedDeliveryDate', 'notes']);
      if (submittedFields.some((field) => !allowed.has(field))) {
        throw new AppError(
          409,
          'PURCHASE_ORDER_LOCKED',
          'Approved and ordered POs allow only delivery-date and note updates.',
        );
      }
    } else if (existing.status !== 'draft') {
      throw new AppError(
        409,
        'PURCHASE_ORDER_LOCKED',
        'Partially received, received, and cancelled POs cannot be edited.',
      );
    }

    const effectiveOrderDate = input.orderDate ?? databaseDate(existing.order_date);
    const effectiveExpectedDate = input.expectedDeliveryDate !== undefined
      ? input.expectedDeliveryDate
      : databaseDate(existing.expected_delivery_date);
    if (effectiveExpectedDate && effectiveExpectedDate < effectiveOrderDate) {
      throw new AppError(
        400,
        'INVALID_EXPECTED_DELIVERY_DATE',
        'Expected delivery cannot be before the order date.',
      );
    }

    const effectiveCurrency = input.currency ?? existing.currency;
    if (input.items) {
      await validatePurchaseOrderItems(database, {
        organizationId,
        supplierId: existing.supplier_id,
        currency: effectiveCurrency,
        items: input.items,
      });
    }

    const changes = {};
    const fieldMap = {
      orderDate: 'order_date',
      expectedDeliveryDate: 'expected_delivery_date',
      currency: 'currency',
      paymentTermsDays: 'payment_terms_days',
      notes: 'notes',
      shippingCost: 'shipping_cost',
      otherCost: 'other_cost',
    };
    for (const [inputField, column] of Object.entries(fieldMap)) {
      if (input[inputField] !== undefined) changes[column] = input[inputField];
    }
    if (Object.keys(changes).length > 0) {
      await purchaseOrderModel.updatePurchaseOrder(database, {
        organizationId,
        id,
        changes,
      });
    }
    if (input.items) {
      await purchaseOrderModel.deletePurchaseOrderItems(database, {
        organizationId,
        purchaseOrderId: id,
      });
      await createItems(database, {
        organizationId,
        purchaseOrderId: id,
        items: input.items,
      });
    }
    await purchaseOrderModel.recalculatePurchaseOrder(database, { organizationId, id });
    await database.query('COMMIT');
    return getPurchaseOrder(organizationId, id);
  } catch (error) {
    await database.query('ROLLBACK');
    throw translatePurchasingError(error);
  } finally {
    database.release();
  }
}

async function transition(organizationId, id, transitionInput) {
  const database = await pool.connect();
  try {
    await database.query('BEGIN');
    const existing = await purchaseOrderModel.findPurchaseOrderById(database, {
      organizationId,
      id,
      forUpdate: true,
    });
    if (!existing) {
      throw new AppError(404, 'PURCHASE_ORDER_NOT_FOUND', 'Purchase order not found.');
    }
    if (!transitionInput.fromStatuses.includes(existing.status)) {
      throw new AppError(
        409,
        'INVALID_PO_STATUS_TRANSITION',
        `A purchase order cannot move from ${existing.status} to ${transitionInput.toStatus}.`,
      );
    }
    const updated = await purchaseOrderModel.transitionPurchaseOrder(database, {
      organizationId,
      id,
      ...transitionInput,
    });
    await database.query('COMMIT');
    return getPurchaseOrder(organizationId, updated.id);
  } catch (error) {
    await database.query('ROLLBACK');
    throw translatePurchasingError(error);
  } finally {
    database.release();
  }
}

export function approvePurchaseOrder(organizationId, id, userId) {
  return transition(organizationId, id, {
    fromStatuses: ['draft'],
    toStatus: 'approved',
    approvedBy: userId,
  });
}

export function markPurchaseOrderOrdered(organizationId, id) {
  return transition(organizationId, id, {
    fromStatuses: ['approved'],
    toStatus: 'ordered',
  });
}

export function cancelPurchaseOrder(organizationId, id) {
  return transition(organizationId, id, {
    fromStatuses: ['draft', 'approved', 'ordered'],
    toStatus: 'cancelled',
  });
}
