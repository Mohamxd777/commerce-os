import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { barcodeSchema, skuCodeSchema } from '../src/validators/catalogValidators.js';

describe('catalog validation', () => {
  it('normalizes a readable SKU code to uppercase', () => {
    assert.equal(skuCodeSchema.parse('mou-log-g102-blk'), 'MOU-LOG-G102-BLK');
  });

  it('rejects garbage SKU codes', () => {
    assert.equal(skuCodeSchema.safeParse('??').success, false);
    assert.equal(skuCodeSchema.safeParse('SKU WITH SPACES').success, false);
  });

  it('validates standardized barcode content and length', () => {
    assert.equal(
      barcodeSchema.safeParse({
        type: 'ean',
        value: '1234567890123',
      }).success,
      true,
    );
    assert.equal(
      barcodeSchema.safeParse({
        type: 'upc',
        value: 'NOT-A-BARCODE',
      }).success,
      false,
    );
  });
});
