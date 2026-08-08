import { describe, expect, it } from 'vitest';
import { suggestSku } from './skuSuggestion.js';

describe('SKU suggestion', () => {
  it('suggests the documented category-brand-model-variant shape', () => {
    expect(
      suggestSku({
        category: 'Mouse',
        brand: 'Logitech',
        model: 'G102',
        variant: 'Black',
      }),
    ).toBe('MOU-LOG-G102-BLK');
  });
});
