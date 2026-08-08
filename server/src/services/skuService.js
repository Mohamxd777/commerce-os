import { pool } from '../config/database.js';
import { paginationMetadata } from '../models/catalogModelHelpers.js';
import * as skuModel from '../models/skuModel.js';
import { AppError } from '../utils/AppError.js';
import { translateCatalogError } from './catalogErrors.js';
import { validateBarcodeSet } from './catalogInputRules.js';

export async function listSkus(organizationId, query) {
  const result = await skuModel.listSkus(pool, {
    organizationId,
    ...query,
  });
  return {
    items: result.rows,
    pagination: paginationMetadata(result.total, query.page, query.limit),
  };
}

export async function getSku(organizationId, id) {
  const sku = await skuModel.findSkuById(pool, { organizationId, id });
  if (!sku) {
    throw new AppError(404, 'SKU_NOT_FOUND', 'SKU not found.');
  }
  return sku;
}

export async function createSku(organizationId, input) {
  validateBarcodeSet(input.barcodes);
  const database = await pool.connect();

  try {
    await database.query('BEGIN');
    const variant = await skuModel.findVariantById(database, {
      organizationId,
      id: input.productVariantId,
    });
    if (!variant) {
      throw new AppError(
        400,
        'VARIANT_NOT_FOUND',
        'The product variant does not exist in this organization.',
      );
    }

    const sku = await skuModel.createSku(database, {
      organizationId,
      ...input,
    });
    await skuModel.createBarcodes(database, {
      organizationId,
      skuId: sku.id,
      barcodes: input.barcodes,
    });

    await database.query('COMMIT');
    return getSku(organizationId, sku.id);
  } catch (error) {
    await database.query('ROLLBACK');
    throw translateCatalogError(error);
  } finally {
    database.release();
  }
}

export async function patchSku(organizationId, id, input) {
  if (input.barcodes) {
    validateBarcodeSet(input.barcodes);
  }

  const database = await pool.connect();

  try {
    await database.query('BEGIN');
    const existing = await skuModel.findSkuById(database, { organizationId, id });
    if (!existing) {
      throw new AppError(404, 'SKU_NOT_FOUND', 'SKU not found.');
    }

    const changes = {};
    if (input.manufacturerPartNumber !== undefined) {
      changes.manufacturer_part_number = input.manufacturerPartNumber;
    }
    if (input.serialTrackingEnabled !== undefined) {
      changes.serial_tracking_enabled = input.serialTrackingEnabled;
    }
    if (input.isActive !== undefined) {
      changes.is_active = input.isActive;
    }

    if (Object.keys(changes).length > 0) {
      await skuModel.updateSku(database, { organizationId, id, changes });
    }
    if (input.barcodes !== undefined) {
      await skuModel.replaceBarcodes(database, {
        organizationId,
        skuId: id,
        barcodes: input.barcodes,
      });
    }

    await database.query('COMMIT');
    return getSku(organizationId, id);
  } catch (error) {
    await database.query('ROLLBACK');
    throw translateCatalogError(error);
  } finally {
    database.release();
  }
}
