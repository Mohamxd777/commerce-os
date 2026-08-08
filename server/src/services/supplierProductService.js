import { pool } from '../config/database.js';
import { paginationMetadata } from '../models/catalogModelHelpers.js';
import * as supplierModel from '../models/supplierModel.js';
import * as supplierProductModel from '../models/supplierProductModel.js';
import { AppError } from '../utils/AppError.js';
import { translatePurchasingError } from './purchasingErrors.js';

function canonicalDecimal(value) {
  const [whole, fraction = ''] = String(value).split('.');
  const normalizedWhole = whole.replace(/^0+(?=\d)/, '');
  const normalizedFraction = fraction.replace(/0+$/, '');
  return normalizedFraction ? normalizedWhole + '.' + normalizedFraction : normalizedWhole;
}

export async function listSupplierProducts(organizationId, query) {
  const result = await supplierProductModel.listSupplierProducts(pool, {
    organizationId,
    ...query,
  });
  return {
    items: result.rows,
    pagination: paginationMetadata(result.total, query.page, query.limit),
  };
}

export async function getSupplierProduct(organizationId, id) {
  const supplierProduct = await supplierProductModel.findSupplierProductById(pool, {
    organizationId,
    id,
  });
  if (!supplierProduct) {
    throw new AppError(404, 'SUPPLIER_PRODUCT_NOT_FOUND', 'Supplier product not found.');
  }
  const priceHistory = await supplierProductModel.listPriceHistory(pool, {
    organizationId,
    supplierProductId: id,
  });
  return { ...supplierProduct, priceHistory };
}

export async function createSupplierProduct(organizationId, input) {
  const database = await pool.connect();
  try {
    await database.query('BEGIN');
    const [supplier, sku] = await Promise.all([
      supplierModel.findSupplierById(database, { organizationId, id: input.supplierId }),
      supplierProductModel.findSku(database, { organizationId, id: input.skuId }),
    ]);
    if (!supplier) {
      throw new AppError(400, 'SUPPLIER_NOT_FOUND', 'Supplier not found in this organization.');
    }
    if (!supplier.is_active) {
      throw new AppError(409, 'SUPPLIER_INACTIVE', 'Reactivate the supplier before linking a SKU.');
    }
    if (!sku) {
      throw new AppError(400, 'SKU_NOT_FOUND', 'SKU not found in this organization.');
    }
    if (!sku.is_active) {
      throw new AppError(409, 'SKU_INACTIVE', 'An inactive SKU cannot be linked for purchasing.');
    }

    if (input.preferred && input.isActive) {
      await supplierProductModel.clearPreferredForSku(database, {
        organizationId,
        skuId: input.skuId,
      });
    }
    const supplierProduct = await supplierProductModel.createSupplierProduct(database, {
      organizationId,
      ...input,
    });
    await supplierProductModel.createPriceHistory(database, {
      organizationId,
      supplierProductId: supplierProduct.id,
      unitCost: input.currentUnitCost,
      currency: input.currency,
      source: 'Initial supplier product price',
    });
    await database.query('COMMIT');
    return getSupplierProduct(organizationId, supplierProduct.id);
  } catch (error) {
    await database.query('ROLLBACK');
    throw translatePurchasingError(error);
  } finally {
    database.release();
  }
}

export async function patchSupplierProduct(organizationId, id, input) {
  const database = await pool.connect();
  try {
    await database.query('BEGIN');
    const existing = await supplierProductModel.findSupplierProductById(database, {
      organizationId,
      id,
      forUpdate: true,
    });
    if (!existing) {
      throw new AppError(404, 'SUPPLIER_PRODUCT_NOT_FOUND', 'Supplier product not found.');
    }

    const finalActive = input.isActive ?? existing.is_active;
    const finalPreferred = input.preferred ?? existing.preferred;
    if (finalActive && finalPreferred) {
      await supplierProductModel.clearPreferredForSku(database, {
        organizationId,
        skuId: existing.sku_id,
        exceptId: id,
      });
    }

    const changes = {};
    const fieldMap = {
      supplierSkuCode: 'supplier_sku_code',
      moq: 'moq',
      leadTimeDays: 'lead_time_days',
      preferred: 'preferred',
      isActive: 'is_active',
      notes: 'notes',
    };
    for (const [inputField, column] of Object.entries(fieldMap)) {
      if (input[inputField] !== undefined) changes[column] = input[inputField];
    }
    if (input.isActive === false) changes.preferred = false;

    await supplierProductModel.updateSupplierProduct(database, {
      organizationId,
      id,
      changes,
    });
    await database.query('COMMIT');
    return getSupplierProduct(organizationId, id);
  } catch (error) {
    await database.query('ROLLBACK');
    throw translatePurchasingError(error);
  } finally {
    database.release();
  }
}

export async function updateSupplierPrice(organizationId, id, input) {
  const database = await pool.connect();
  try {
    await database.query('BEGIN');
    const existing = await supplierProductModel.findSupplierProductById(database, {
      organizationId,
      id,
      forUpdate: true,
    });
    if (!existing) {
      throw new AppError(404, 'SUPPLIER_PRODUCT_NOT_FOUND', 'Supplier product not found.');
    }
    if (
      canonicalDecimal(existing.current_unit_cost) === canonicalDecimal(input.unitCost)
      && existing.currency === input.currency
    ) {
      throw new AppError(400, 'PRICE_UNCHANGED', 'Enter a different cost or currency.');
    }

    const effectiveAt = new Date();
    const closedCount = await supplierProductModel.closeCurrentPriceHistory(database, {
      organizationId,
      supplierProductId: id,
      effectiveTo: effectiveAt,
    });
    if (closedCount !== 1) {
      throw new AppError(
        409,
        'PRICE_HISTORY_INCONSISTENT',
        'The current supplier price history could not be closed safely.',
      );
    }
    await supplierProductModel.updateSupplierProduct(database, {
      organizationId,
      id,
      changes: {
        current_unit_cost: input.unitCost,
        currency: input.currency,
      },
    });
    await supplierProductModel.createPriceHistory(database, {
      organizationId,
      supplierProductId: id,
      unitCost: input.unitCost,
      currency: input.currency,
      effectiveFrom: effectiveAt,
      source: input.source,
      notes: input.notes,
    });
    await database.query('COMMIT');
    return getSupplierProduct(organizationId, id);
  } catch (error) {
    await database.query('ROLLBACK');
    throw translatePurchasingError(error);
  } finally {
    database.release();
  }
}

export async function compareSkuSuppliers(organizationId, skuId, query) {
  const sku = await supplierProductModel.findSku(pool, { organizationId, id: skuId });
  if (!sku) {
    throw new AppError(404, 'SKU_NOT_FOUND', 'SKU not found.');
  }
  const result = await supplierProductModel.listSupplierProducts(pool, {
    organizationId,
    search: undefined,
    supplierId: undefined,
    skuId,
    isActive: query.isActive,
    preferred: undefined,
    page: query.page,
    limit: query.limit,
  });
  return {
    sku,
    items: result.rows,
    pagination: paginationMetadata(result.total, query.page, query.limit),
  };
}
