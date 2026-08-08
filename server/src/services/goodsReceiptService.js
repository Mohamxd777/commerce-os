import { randomUUID } from 'node:crypto';
import { pool } from '../config/database.js';
import { paginationMetadata } from '../models/catalogModelHelpers.js';
import * as goodsReceiptModel from '../models/goodsReceiptModel.js';
import * as purchaseOrderModel from '../models/purchaseOrderModel.js';
import { AppError } from '../utils/AppError.js';
import { translatePurchasingError } from './purchasingErrors.js';

function generatedReceiptNumber() {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return 'GR-' + date + '-' + randomUUID().slice(0, 8).toUpperCase();
}

function databaseDate(value) {
  return value instanceof Date
    ? value.toISOString().slice(0, 10)
    : String(value).slice(0, 10);
}

export async function listGoodsReceipts(organizationId, query) {
  const result = await goodsReceiptModel.listGoodsReceipts(pool, {
    organizationId,
    ...query,
  });
  return {
    items: result.rows,
    pagination: paginationMetadata(result.total, query.page, query.limit),
  };
}

export async function getGoodsReceipt(organizationId, id) {
  const receipt = await goodsReceiptModel.findGoodsReceiptById(pool, {
    organizationId,
    id,
  });
  if (!receipt) {
    throw new AppError(404, 'GOODS_RECEIPT_NOT_FOUND', 'Goods receipt not found.');
  }
  const items = await goodsReceiptModel.listGoodsReceiptItems(pool, {
    organizationId,
    goodsReceiptId: id,
  });
  return { ...receipt, items };
}

export async function createGoodsReceipt(organizationId, purchaseOrderId, userId, input) {
  const database = await pool.connect();
  try {
    await database.query('BEGIN');
    const purchaseOrder = await purchaseOrderModel.findPurchaseOrderById(database, {
      organizationId,
      id: purchaseOrderId,
      forUpdate: true,
    });
    if (!purchaseOrder) {
      throw new AppError(404, 'PURCHASE_ORDER_NOT_FOUND', 'Purchase order not found.');
    }
    if (!['ordered', 'partially_received'].includes(purchaseOrder.status)) {
      throw new AppError(
        409,
        'PURCHASE_ORDER_NOT_RECEIVABLE',
        'Only ordered or partially received purchase orders can be received.',
      );
    }
    if (input.receivedDate < databaseDate(purchaseOrder.order_date)) {
      throw new AppError(
        400,
        'INVALID_RECEIPT_DATE',
        'Goods cannot be received before the purchase-order date.',
      );
    }

    const location = await goodsReceiptModel.findLocation(database, {
      organizationId,
      id: input.locationId,
    });
    if (!location || location.status !== 'active') {
      throw new AppError(
        400,
        'LOCATION_NOT_AVAILABLE',
        'Choose an active receiving location in this organization.',
      );
    }

    const orderItems = await purchaseOrderModel.lockPurchaseOrderItems(database, {
      organizationId,
      purchaseOrderId,
    });
    const orderItemsById = new Map(orderItems.map((item) => [item.id, item]));
    const requestItemIds = new Set();
    for (const item of input.items) {
      if (requestItemIds.has(item.purchaseOrderItemId)) {
        throw new AppError(
          400,
          'DUPLICATE_RECEIPT_ITEM',
          'A purchase-order line may appear only once in a receipt.',
        );
      }
      requestItemIds.add(item.purchaseOrderItemId);
      if (!orderItemsById.has(item.purchaseOrderItemId)) {
        throw new AppError(
          400,
          'INVALID_RECEIPT_ITEM',
          'A receipt item does not belong to this purchase order.',
        );
      }
    }

    const acceptedRows = await purchaseOrderModel.totalAcceptedForItems(database, {
      organizationId,
      itemIds: orderItems.map((item) => item.id),
    });
    const alreadyAccepted = new Map(
      acceptedRows.map((row) => [row.purchase_order_item_id, row.accepted_quantity]),
    );
    for (const item of input.items) {
      const orderItem = orderItemsById.get(item.purchaseOrderItemId);
      const comparison = await database.query(
        'SELECT $1::numeric + $2::numeric <= $3::numeric AS allowed',
        [alreadyAccepted.get(item.purchaseOrderItemId) ?? '0', item.quantityReceived, orderItem.quantity_ordered],
      );
      if (!comparison.rows[0].allowed) {
        throw new AppError(
          409,
          'OVER_RECEIPT_NOT_ALLOWED',
          'Accepted quantity would exceed the remaining ordered quantity.',
        );
      }
    }

    const receipt = await goodsReceiptModel.createGoodsReceipt(database, {
      organizationId,
      purchaseOrderId,
      receiptNumber: input.receiptNumber ?? generatedReceiptNumber(),
      receivedDate: input.receivedDate,
      locationId: input.locationId,
      notes: input.notes,
      receivedBy: userId,
    });
    for (const item of input.items) {
      const orderItem = orderItemsById.get(item.purchaseOrderItemId);
      await goodsReceiptModel.createGoodsReceiptItem(database, {
        organizationId,
        goodsReceiptId: receipt.id,
        purchaseOrderItemId: item.purchaseOrderItemId,
        skuId: orderItem.sku_id,
        quantityReceived: item.quantityReceived,
        quantityRejected: item.quantityRejected,
        conditionNotes: item.conditionNotes,
      });
    }

    const totals = await goodsReceiptModel.purchaseOrderReceivingTotals(database, {
      organizationId,
      purchaseOrderId,
    });
    const statusResult = await database.query(
      `SELECT $1::numeric = $2::numeric AS complete,
              $2::numeric > 0 AS has_accepted`,
      [totals.ordered_quantity, totals.accepted_quantity],
    );
    const receivingState = statusResult.rows[0];
    const nextStatus = receivingState.complete
      ? 'received'
      : receivingState.has_accepted
        ? 'partially_received'
        : purchaseOrder.status;
    await purchaseOrderModel.setReceivingStatus(database, {
      organizationId,
      id: purchaseOrderId,
      status: nextStatus,
    });
    await database.query('COMMIT');
    return getGoodsReceipt(organizationId, receipt.id);
  } catch (error) {
    await database.query('ROLLBACK');
    throw translatePurchasingError(error);
  } finally {
    database.release();
  }
}
