import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeSupplierIdentity } from '../src/services/researchService.js';
import { explainSupplierRecommendations } from '../src/services/supplierProductService.js';

test('supplier identity matching is deterministic across case, whitespace and punctuation', () => {
  assert.equal(normalizeSupplierIdentity('  Al-Alameya... Trading  '), 'al alameya trading');
  assert.equal(normalizeSupplierIdentity('AL / ALAMEYA   TRADING'), 'al alameya trading');
  assert.notEqual(normalizeSupplierIdentity('Al Alameya Trading'), normalizeSupplierIdentity('Al Alameya Electronics'));
});

test('supplier recommendation can prefer reliable terms over the cheapest quote and explains why', () => {
  const now = new Date('2026-08-12T12:00:00.000Z');
  const items = explainSupplierRecommendations([
    {
      id: 'reliable', supplier_name: 'Reliable Supply', current_unit_cost: '210', moq: '1',
      lead_time_days: 2, preferred: false, sample_state: 'passed',
      defective_unit_replacement: true, warranty_text: '12 months', last_quote_date: '2026-08-10',
    },
    {
      id: 'cheap', supplier_name: 'Cheap Supply', current_unit_cost: '190', moq: '10',
      lead_time_days: 14, preferred: false, sample_state: null,
      defective_unit_replacement: false, warranty_text: null, last_quote_date: null,
    },
  ], now);
  const reliable = items.find((item) => item.id === 'reliable');
  const cheap = items.find((item) => item.id === 'cheap');
  assert.equal(reliable.is_recommended, true);
  assert.equal(cheap.is_recommended, false);
  assert.ok(reliable.recommendation_reasons.includes('Linked sample passed'));
  assert.ok(cheap.recommendation_reasons.includes('Lowest current unit cost'));
  assert.deepEqual(cheap.missing_recommendation_data.sort(), ['passed sample', 'quote freshness', 'warranty']);
});

