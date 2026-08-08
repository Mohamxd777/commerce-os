import { describe, expect, it } from 'vitest';
import { inventoryTerms } from './InventoryTerms.js';

describe('Inventory business terms', () => {
  it('keeps the required Arabic explanations', () => {
    expect(inventoryTerms['ROP / Reorder Point']).toBe('مستوى المخزون الذي عند الوصول إليه تبدأ التفكير في طلب كمية جديدة.');
    expect(inventoryTerms['Safety Stock']).toContain('كمية احتياطية');
    expect(inventoryTerms['Available Stock']).toContain('القابلة للبيع');
    expect(inventoryTerms['Reserved Stock']).toContain('محجوزة لطلبات');
    expect(inventoryTerms['Quarantine Stock']).toContain('معزول مؤقتًا');
    expect(inventoryTerms['Stock Adjustment']).toContain('حركة تصحيح');
    expect(inventoryTerms['Inventory Ledger']).toContain('سجل لكل حركة');
  });
});
