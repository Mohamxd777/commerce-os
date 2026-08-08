import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  goodsReceiptCreateSchema,
  supplierCreateSchema,
  supplierProductCreateSchema,
} from '../src/validators/purchasingValidators.js';

describe('purchasing validation', () => {
  it('normalizes ISO currency codes and decimal inputs', () => {
    const result = supplierProductCreateSchema.safeParse({
      body: {
        supplierId: '11111111-1111-4111-8111-111111111111',
        skuId: '22222222-2222-4222-8222-222222222222',
        currentUnitCost: '12.3400',
        currency: 'usd',
        moq: 5,
        leadTimeDays: 7,
      },
      params: {},
      query: {},
    });

    assert.equal(result.success, true);
    assert.equal(result.data.body.currency, 'USD');
    assert.equal(result.data.body.moq, '5');
  });

  it('rejects zero MOQ and negative lead time', () => {
    const result = supplierProductCreateSchema.safeParse({
      body: {
        supplierId: '11111111-1111-4111-8111-111111111111',
        skuId: '22222222-2222-4222-8222-222222222222',
        currentUnitCost: '12.34',
        currency: 'USD',
        moq: '0',
        leadTimeDays: -1,
      },
      params: {},
      query: {},
    });

    assert.equal(result.success, false);
  });

  it('rejects malformed supplier contact data', () => {
    const result = supplierCreateSchema.safeParse({
      body: {
        name: 'Supplier',
        phone: 'abc',
        email: 'invalid',
        preferredCurrency: 'EGP',
      },
      params: {},
      query: {},
    });

    assert.equal(result.success, false);
  });

  it('requires an accepted or rejected receipt quantity', () => {
    const result = goodsReceiptCreateSchema.safeParse({
      params: { id: '11111111-1111-4111-8111-111111111111' },
      body: {
        receivedDate: '2026-08-08',
        locationId: '22222222-2222-4222-8222-222222222222',
        items: [{
          purchaseOrderItemId: '33333333-3333-4333-8333-333333333333',
          quantityReceived: '0',
          quantityRejected: '0',
        }],
      },
      query: {},
    });

    assert.equal(result.success, false);
  });
});
