import { randomUUID } from 'node:crypto';
import { pool } from '../config/database.js';
import { paginationMetadata } from '../models/catalogModelHelpers.js';
import * as inventoryModel from '../models/inventoryModel.js';
import { AppError } from '../utils/AppError.js';
import { translateInventoryError } from './inventoryErrors.js';

function generatedTransferNumber() {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return 'TR-' + date + '-' + randomUUID().slice(0, 8).toUpperCase();
}

async function transaction(work) {
  const database = await pool.connect();
  try {
    await database.query('BEGIN');
    const result = await work(database);
    await database.query('COMMIT');
    return result;
  } catch (error) {
    await database.query('ROLLBACK');
    throw translateInventoryError(error);
  } finally {
    database.release();
  }
}

function ensureOperationalSku(sku) {
  if (!sku) {
    throw new AppError(404, 'SKU_NOT_FOUND', 'SKU not found.');
  }
  if (!sku.is_active) {
    throw new AppError(400, 'SKU_NOT_ACTIVE', 'Inventory operations require an active SKU.');
  }
}

function ensureOperationalLocation(location, label = 'Location') {
  if (!location) {
    throw new AppError(404, 'LOCATION_NOT_FOUND', label + ' not found.');
  }
  if (location.status !== 'active') {
    throw new AppError(400, 'LOCATION_NOT_ACTIVE', label + ' must be active.');
  }
}

async function validateDimensions(database, organizationId, skuId, locationId) {
  const [sku, location] = await Promise.all([
    inventoryModel.findActiveSku(database, { organizationId, id: skuId }),
    inventoryModel.findActiveLocation(database, { organizationId, id: locationId }),
  ]);
  ensureOperationalSku(sku);
  ensureOperationalLocation(location);
  return { sku, location };
}

export async function listInventory(organizationId, query) {
  const result = await inventoryModel.listStock(pool, { organizationId, ...query });
  return {
    items: result.rows,
    pagination: paginationMetadata(result.total, query.page, query.limit),
  };
}

export function getInventorySummary(organizationId) {
  return inventoryModel.getInventorySummary(pool, { organizationId });
}

export async function listInventoryMovements(organizationId, query) {
  const result = await inventoryModel.listMovements(pool, { organizationId, ...query });
  return {
    items: result.rows,
    pagination: paginationMetadata(result.total, query.page, query.limit),
  };
}

export async function getSkuInventory(organizationId, skuId) {
  const inventory = await inventoryModel.getSkuInventory(pool, { organizationId, skuId });
  if (!inventory) {
    throw new AppError(404, 'SKU_NOT_FOUND', 'SKU not found.');
  }
  return inventory;
}

export function reconcileInventory(organizationId) {
  return inventoryModel.reconcileInventory(pool, { organizationId });
}

function movementTypeForBucketMove(fromBucket, destinationBucket) {
  if (destinationBucket === 'quarantine') return 'QUARANTINE_IN';
  if (fromBucket === 'quarantine' && destinationBucket === 'available') {
    return 'RELEASE_FROM_QUARANTINE';
  }
  if (destinationBucket === 'damaged') return 'DAMAGE';
  if (destinationBucket === 'reserved') return 'RESERVATION';
  if (fromBucket === 'reserved' && destinationBucket === 'available') {
    return 'RESERVATION_RELEASE';
  }
  if (fromBucket === 'quarantine') return 'QUARANTINE_OUT';
  return 'ADJUSTMENT_OUT';
}

export async function createAdjustment(organizationId, userId, input) {
  return transaction(async (database) => {
    await validateDimensions(database, organizationId, input.skuId, input.locationId);
    const correlationId = randomUUID();
    const referenceId = randomUUID();
    const common = {
      organizationId,
      skuId: input.skuId,
      locationId: input.locationId,
      referenceType: 'inventory_adjustment',
      referenceId,
      correlationId,
      reason: input.reason,
      notes: input.notes,
      occurredAt: input.occurredAt,
      createdBy: userId,
    };

    if (input.direction === 'move') {
      if (!input.destinationBucket || input.destinationBucket === input.stockBucket) {
        throw new AppError(
          400,
          'INVALID_BUCKET_MOVE',
          'Choose a different destination bucket for a bucket movement.',
        );
      }
      const movementType = movementTypeForBucketMove(
        input.stockBucket,
        input.destinationBucket,
      );
      const quantity = String(input.quantity);
      const outbound = await inventoryModel.appendMovement(database, {
        ...common,
        movementType,
        quantity: '-' + quantity,
        stockBucket: input.stockBucket,
        idempotencyKey: 'adjustment:' + referenceId + ':out',
      });
      const inbound = await inventoryModel.appendMovement(database, {
        ...common,
        movementType,
        quantity,
        stockBucket: input.destinationBucket,
        idempotencyKey: 'adjustment:' + referenceId + ':in',
      });
      return { referenceId, correlationId, movements: [outbound, inbound] };
    }

    const inbound = input.direction === 'in';
    const movement = await inventoryModel.appendMovement(database, {
      ...common,
      movementType: inbound ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
      quantity: inbound ? input.quantity : '-' + input.quantity,
      stockBucket: input.stockBucket,
      idempotencyKey: 'adjustment:' + referenceId,
    });
    return { referenceId, correlationId, movements: [movement] };
  });
}

export async function postGoodsReceiptInventory(organizationId, receiptId, userId) {
  const outcome = await transaction(async (database) => {
    const receipt = await inventoryModel.findGoodsReceiptForPosting(database, {
      organizationId,
      id: receiptId,
      forUpdate: true,
    });
    if (!receipt) {
      throw new AppError(404, 'GOODS_RECEIPT_NOT_FOUND', 'Goods receipt not found.');
    }
    if (receipt.inventory_posted_at) {
      return { receipt, movements: [], alreadyPosted: true };
    }
    ensureOperationalLocation({ id: receipt.location_id, status: receipt.location_status });

    const items = await inventoryModel.listGoodsReceiptItemsForPosting(database, {
      organizationId,
      receiptId,
    });
    const correlationId = randomUUID();
    const movements = [];
    for (const item of items) {
      if (Number(item.quantity_received) <= 0) continue;
      movements.push(await inventoryModel.appendMovement(database, {
        organizationId,
        skuId: item.sku_id,
        locationId: receipt.location_id,
        movementType: 'PURCHASE_RECEIPT',
        quantity: item.quantity_received,
        stockBucket: 'available',
        referenceType: 'goods_receipt',
        referenceId: receipt.id,
        correlationId,
        idempotencyKey: 'goods-receipt:' + receipt.id + ':item:' + item.id,
        reason: 'Accepted goods receipt quantity',
        notes: receipt.notes,
        occurredAt: receipt.received_date + 'T12:00:00Z',
        createdBy: userId,
      }));
    }
    const postedReceipt = await inventoryModel.markGoodsReceiptPosted(database, {
      organizationId,
      id: receiptId,
      userId,
    });
    if (!postedReceipt) {
      throw new AppError(
        409,
        'GOODS_RECEIPT_ALREADY_POSTED',
        'The goods receipt was already posted by another request.',
      );
    }
    return { receipt: postedReceipt, movements, alreadyPosted: false };
  });
  return outcome;
}

export async function listReorderRules(organizationId, query) {
  const result = await inventoryModel.listReorderRules(pool, { organizationId, ...query });
  return {
    items: result.rows,
    pagination: paginationMetadata(result.total, query.page, query.limit),
  };
}

async function validateRuleReferences(database, organizationId, input, fallbackSkuId) {
  const skuId = input.skuId ?? fallbackSkuId;
  if (input.skuId || input.locationId) {
    const sku = await inventoryModel.findActiveSku(database, { organizationId, id: skuId });
    ensureOperationalSku(sku);
    if (input.locationId) {
      const location = await inventoryModel.findActiveLocation(database, {
        organizationId,
        id: input.locationId,
      });
      ensureOperationalLocation(location);
    }
  }
  if (Object.hasOwn(input, 'preferredSupplierProductId') && input.preferredSupplierProductId) {
    const valid = await inventoryModel.validateSupplierProductForSku(database, {
      organizationId,
      id: input.preferredSupplierProductId,
      skuId,
    });
    if (!valid) {
      throw new AppError(
        400,
        'INVALID_PREFERRED_SUPPLIER_PRODUCT',
        'Preferred supplier product must be an active relationship for this SKU.',
      );
    }
  }
}

export async function createReorderRule(organizationId, input) {
  return transaction(async (database) => {
    await validateDimensions(database, organizationId, input.skuId, input.locationId);
    await validateRuleReferences(database, organizationId, input, input.skuId);
    return inventoryModel.createReorderRule(database, { organizationId, ...input });
  });
}

export async function patchReorderRule(organizationId, id, input) {
  return transaction(async (database) => {
    const rule = await inventoryModel.findReorderRule(database, {
      organizationId,
      id,
      forUpdate: true,
    });
    if (!rule) {
      throw new AppError(404, 'REORDER_RULE_NOT_FOUND', 'Reorder rule not found.');
    }
    await validateRuleReferences(database, organizationId, input, rule.sku_id);
    return inventoryModel.updateReorderRule(database, { organizationId, id, input });
  });
}

export async function listTransfers(organizationId, query) {
  const result = await inventoryModel.listTransfers(pool, { organizationId, ...query });
  return {
    items: result.rows,
    pagination: paginationMetadata(result.total, query.page, query.limit),
  };
}

async function getTransferFromDatabase(database, organizationId, id, forUpdate = false) {
  const transfer = await inventoryModel.findTransfer(database, { organizationId, id, forUpdate });
  if (!transfer) {
    throw new AppError(404, 'INVENTORY_TRANSFER_NOT_FOUND', 'Inventory transfer not found.');
  }
  const items = await inventoryModel.listTransferItems(database, {
    organizationId,
    transferId: id,
  });
  return { ...transfer, items };
}

export function getTransfer(organizationId, id) {
  return getTransferFromDatabase(pool, organizationId, id);
}

async function validateTransferInput(database, organizationId, input) {
  if (input.sourceLocationId === input.destinationLocationId) {
    throw new AppError(
      400,
      'TRANSFER_SAME_LOCATION',
      'Source and destination locations must be different.',
    );
  }
  const [source, destination] = await Promise.all([
    inventoryModel.findActiveLocation(database, { organizationId, id: input.sourceLocationId }),
    inventoryModel.findActiveLocation(database, { organizationId, id: input.destinationLocationId }),
  ]);
  ensureOperationalLocation(source, 'Source location');
  ensureOperationalLocation(destination, 'Destination location');

  const seen = new Set();
  for (const item of input.items ?? []) {
    if (seen.has(item.skuId)) {
      throw new AppError(400, 'DUPLICATE_TRANSFER_SKU', 'A SKU may appear only once.');
    }
    seen.add(item.skuId);
    const sku = await inventoryModel.findActiveSku(database, { organizationId, id: item.skuId });
    ensureOperationalSku(sku);
  }
}

export async function createTransfer(organizationId, userId, input) {
  return transaction(async (database) => {
    await validateTransferInput(database, organizationId, input);
    const transfer = await inventoryModel.createTransfer(database, {
      organizationId,
      transferNumber: input.transferNumber ?? generatedTransferNumber(),
      sourceLocationId: input.sourceLocationId,
      destinationLocationId: input.destinationLocationId,
      notes: input.notes,
      createdBy: userId,
    });
    await inventoryModel.replaceTransferItems(database, {
      organizationId,
      transferId: transfer.id,
      items: input.items,
    });
    return getTransferFromDatabase(database, organizationId, transfer.id);
  });
}

export async function patchTransfer(organizationId, id, input) {
  return transaction(async (database) => {
    const transfer = await getTransferFromDatabase(database, organizationId, id, true);
    if (transfer.status !== 'draft') {
      throw new AppError(
        409,
        'TRANSFER_NOT_EDITABLE',
        'Only draft transfers can be edited.',
      );
    }
    const candidate = {
      sourceLocationId: input.sourceLocationId ?? transfer.source_location_id,
      destinationLocationId: input.destinationLocationId ?? transfer.destination_location_id,
      items: input.items ?? transfer.items.map((item) => ({
        skuId: item.sku_id,
        quantity: item.quantity,
      })),
    };
    await validateTransferInput(database, organizationId, candidate);
    await inventoryModel.updateDraftTransfer(database, { organizationId, id, input });
    if (input.items) {
      await inventoryModel.replaceTransferItems(database, {
        organizationId,
        transferId: id,
        items: input.items,
      });
    }
    return getTransferFromDatabase(database, organizationId, id);
  });
}

export async function shipTransfer(organizationId, id, userId) {
  return transaction(async (database) => {
    const transfer = await getTransferFromDatabase(database, organizationId, id, true);
    if (['in_transit', 'received'].includes(transfer.status)) {
      return { ...transfer, idempotent: true };
    }
    if (transfer.status !== 'draft') {
      throw new AppError(409, 'TRANSFER_NOT_SHIPPABLE', 'Only draft transfers can be shipped.');
    }
    ensureOperationalLocation({ id: transfer.source_location_id, status: transfer.source_location_status }, 'Source location');
    ensureOperationalLocation({ id: transfer.destination_location_id, status: transfer.destination_location_status }, 'Destination location');
    for (const item of [...transfer.items].sort((a, b) => a.sku_id.localeCompare(b.sku_id))) {
      await inventoryModel.appendMovement(database, {
        organizationId,
        skuId: item.sku_id,
        locationId: transfer.source_location_id,
        movementType: 'TRANSFER_OUT',
        quantity: '-' + item.quantity,
        stockBucket: 'available',
        referenceType: 'inventory_transfer',
        referenceId: transfer.id,
        correlationId: transfer.id,
        idempotencyKey: 'transfer:' + transfer.id + ':ship:' + item.id,
        reason: 'Inventory transfer shipped',
        notes: transfer.notes,
        createdBy: userId,
      });
    }
    await inventoryModel.setTransferStatus(database, {
      organizationId,
      id,
      status: 'in_transit',
      userId,
    });
    return { ...(await getTransferFromDatabase(database, organizationId, id)), idempotent: false };
  });
}

export async function receiveTransfer(organizationId, id, userId) {
  return transaction(async (database) => {
    const transfer = await getTransferFromDatabase(database, organizationId, id, true);
    if (transfer.status === 'received') {
      return { ...transfer, idempotent: true };
    }
    if (transfer.status !== 'in_transit') {
      throw new AppError(
        409,
        'TRANSFER_NOT_RECEIVABLE',
        'Only in-transit transfers can be received.',
      );
    }
    ensureOperationalLocation({ id: transfer.destination_location_id, status: transfer.destination_location_status }, 'Destination location');
    for (const item of [...transfer.items].sort((a, b) => a.sku_id.localeCompare(b.sku_id))) {
      await inventoryModel.appendMovement(database, {
        organizationId,
        skuId: item.sku_id,
        locationId: transfer.destination_location_id,
        movementType: 'TRANSFER_IN',
        quantity: item.quantity,
        stockBucket: 'available',
        referenceType: 'inventory_transfer',
        referenceId: transfer.id,
        correlationId: transfer.id,
        idempotencyKey: 'transfer:' + transfer.id + ':receive:' + item.id,
        reason: 'Inventory transfer received',
        notes: transfer.notes,
        createdBy: userId,
      });
    }
    await inventoryModel.setTransferStatus(database, {
      organizationId,
      id,
      status: 'received',
      userId,
    });
    return { ...(await getTransferFromDatabase(database, organizationId, id)), idempotent: false };
  });
}

export async function cancelTransfer(organizationId, id) {
  return transaction(async (database) => {
    const transfer = await getTransferFromDatabase(database, organizationId, id, true);
    if (transfer.status === 'cancelled') return { ...transfer, idempotent: true };
    if (transfer.status !== 'draft') {
      throw new AppError(
        409,
        'TRANSFER_NOT_CANCELLABLE',
        'Only a draft transfer can be cancelled because shipped stock is already in transit.',
      );
    }
    await inventoryModel.setTransferStatus(database, {
      organizationId,
      id,
      status: 'cancelled',
    });
    return { ...(await getTransferFromDatabase(database, organizationId, id)), idempotent: false };
  });
}
