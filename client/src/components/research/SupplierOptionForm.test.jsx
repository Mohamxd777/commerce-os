import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SupplierOptionForm from './SupplierOptionForm.jsx';

afterEach(cleanup);

describe('SupplierOptionForm', () => {
  it('does not force six repeated fields when every quantity has the same price', () => {
    const onSubmit = vi.fn();
    render(<SupplierOptionForm onSubmit={onSubmit} suppliers={[{ id: 'supplier-1', name: 'Al Alameya' }]} />);
    fireEvent.change(screen.getByLabelText('Supplier'), { target: { value: 'supplier-1' } });
    fireEvent.change(screen.getByLabelText('Unit cost'), { target: { value: '86' } });
    expect(screen.queryByLabelText('Price at quantity 100')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add supplier quote' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      supplierId: 'supplier-1', quotedUnitCost: '86', samePriceAllQuantities: true,
      priceQty10: null, priceQty50: null, priceQty100: null,
    }));
  });
});
