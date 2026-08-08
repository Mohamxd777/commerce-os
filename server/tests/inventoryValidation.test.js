import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  adjustmentCreateSchema,
  movementListSchema,
  reorderRuleCreateSchema,
  transferCreateSchema,
} from '../src/validators/inventoryValidators.js';

const id = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';

describe('Inventory validation', () => {
  it('rejects arbitrary movement types and buckets', () => {
    const result = movementListSchema.safeParse({
      body: {},
      params: {},
      query: { movementType: 'FREE_TEXT', stockBucket: 'sellable' },
    });
    assert.equal(result.success, false);
  });

  it('requires positive quantities and a reason for adjustments', () => {
    const result = adjustmentCreateSchema.safeParse({
      params: {},
      query: {},
      body: {
        skuId: id,
        locationId: otherId,
        direction: 'out',
        stockBucket: 'available',
        quantity: '0',
        reason: 'x',
      },
    });
    assert.equal(result.success, false);
  });

  it('requires a distinct destination bucket for bucket moves', () => {
    const result = adjustmentCreateSchema.safeParse({
      params: {},
      query: {},
      body: {
        skuId: id,
        locationId: otherId,
        direction: 'move',
        stockBucket: 'quarantine',
        destinationBucket: 'quarantine',
        quantity: '1',
        reason: 'Inspection complete',
      },
    });
    assert.equal(result.success, false);
  });

  it('rejects zero-quantity transfer lines', () => {
    const result = transferCreateSchema.safeParse({
      params: {},
      query: {},
      body: {
        sourceLocationId: id,
        destinationLocationId: otherId,
        items: [{ skuId: id, quantity: '0' }],
      },
    });
    assert.equal(result.success, false);
  });

  it('accepts precise reorder planning values', () => {
    const result = reorderRuleCreateSchema.safeParse({
      params: {},
      query: {},
      body: {
        skuId: id,
        locationId: otherId,
        reorderPoint: '5.2500',
        safetyStock: '2',
        targetStock: '12.5000',
        preferredSupplierProductId: null,
        isActive: true,
      },
    });
    assert.equal(result.success, true);
  });
});
