import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PurchaseOrderForm from './PurchaseOrderForm.jsx';

afterEach(cleanup);

describe('PurchaseOrderForm', () => {
  it('uses supplier-specific cost data and submits a draft structure', () => {
    const onSubmit = vi.fn();
    render(
      <PurchaseOrderForm
        suppliers={[{ id: 'supplier-1', name: 'Nile', preferred_currency: 'EGP', payment_terms_days: 30 }]}
        skus={[{ id: 'sku-1', sku_code: 'SKU-001', product_name: 'Mouse' }]}
        supplierProducts={[{ id: 'link-1', sku_id: 'sku-1', current_unit_cost: '12.5000', moq: '5.0000', lead_time_days: 7, preferred: true }]}
        onSupplierChange={vi.fn()}
        onSubmit={onSubmit}
        submitting={false}
        error={null}
      />,
    );

    fireEvent.change(screen.getByLabelText('Supplier'), { target: { value: 'supplier-1' } });
    fireEvent.change(screen.getByLabelText('SKU 1'), { target: { value: 'sku-1' } });
    expect(screen.getByLabelText('Unit cost 1')).toHaveValue(12.5);
    expect(screen.getByText(/MOQ/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save as draft' }));

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      supplierId: 'supplier-1',
      currency: 'EGP',
      items: [{
        skuId: 'sku-1',
        supplierProductId: 'link-1',
        quantityOrdered: '10',
        unitCost: '12.5000',
      }],
    });
  });
});
