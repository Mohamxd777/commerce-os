import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  candidateCreateSchema, comparisonSchema, economicsCreateSchema,
  evidenceCreateSchema, quickCaptureCreateSchema, sampleCreateSchema, supplierOptionCreateSchema,
} from '../src/validators/researchValidators.js';

describe('Research validation', () => {
  it('requires either an existing supplier or a temporary supplier lead', () => {
    const result = supplierOptionCreateSchema.safeParse({
      params: { id: '7fd32b2c-164f-4af8-9775-7578ecdf0979' },
      body: { quotedUnitCost: '10', currency: 'EGP', moq: '1', leadTimeDays: 2, preferred: false },
      query: {},
    });
    assert.equal(result.success, false);
  });

  it('keeps quick capture limited to product, supplier, and price requirements', () => {
    const valid = quickCaptureCreateSchema.safeParse({
      params: {}, query: {}, body: { name: 'USB-C Hub', supplierName: 'Al Alameya', unitPrice: '130' },
    });
    assert.equal(valid.success, true);
    const missingSupplier = quickCaptureCreateSchema.safeParse({
      params: {}, query: {}, body: { name: 'USB-C Hub', unitPrice: '130' },
    });
    assert.equal(missingSupplier.success, false);
  });

  it('rejects a 100 percent referral fee that has no break-even solution', () => {
    const result = economicsCreateSchema.safeParse({
      params: { id: '7fd32b2c-164f-4af8-9775-7578ecdf0979' },
      body: { currency: 'EGP', sellingPrice: '100', supplierUnitCost: '20', referralFeePercentage: '100' },
      query: {},
    });
    assert.equal(result.success, false);
  });

  it('accepts domain-neutral sample checklist items', () => {
    const result = sampleCreateSchema.safeParse({
      params: { id: '7fd32b2c-164f-4af8-9775-7578ecdf0979' },
      body: { result: 'pending', checklist: [{ label: 'Packaging quality', passed: null }] },
      query: {},
    });
    assert.equal(result.success, true);
  });

  it('requires external evidence metadata instead of database binary data', () => {
    const result = evidenceCreateSchema.safeParse({
      params: { id: '7fd32b2c-164f-4af8-9775-7578ecdf0979' },
      body: { evidenceType: 'screenshot', title: 'Competitor page' },
      query: {},
    });
    assert.equal(result.success, false);
  });

  it('limits comparison to two through ten valid candidates', () => {
    const result = comparisonSchema.safeParse({ body: {}, params: {}, query: { ids: 'invalid' } });
    assert.equal(result.success, false);
  });

  it('rejects unknown candidate fields', () => {
    const result = candidateCreateSchema.safeParse({
      body: { name: 'Hub', status: 'research', inventoryQuantity: 10 }, params: {}, query: {},
    });
    assert.equal(result.success, false);
  });
});
