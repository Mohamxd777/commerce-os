import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ProductFirstPurchaseOrderForm from './ProductFirstPurchaseOrderForm.jsx';

afterEach(cleanup);

describe('ProductFirstPurchaseOrderForm', () => {
  it('shows explainable linked recommendations and still requires an explicit supplier selection', async () => {
    const onSubmit = vi.fn();
    const options = [
      { id: 'rel-1', supplier_id: 'supplier-1', supplier_name: 'Reliable Supply', current_unit_cost: '210', currency: 'EGP', moq: '1', lead_time_days: 2, is_recommended: true, recommendation_reasons: ['Linked sample passed', 'Warranty terms recorded'], missing_recommendation_data: [], quote_age_days: 5 },
      { id: 'rel-2', supplier_id: 'supplier-2', supplier_name: 'Cheapest Shop', current_unit_cost: '190', currency: 'EGP', moq: '10', lead_time_days: 14, is_recommended: false, recommendation_reasons: ['Lowest current unit cost'], missing_recommendation_data: ['warranty'], quote_age_days: null },
    ];
    render(<ProductFirstPurchaseOrderForm skus={[{ id: 'sku-1', sku_code: 'HUB-01', product_name: 'USB-C Hub' }]} suppliers={[{ id: 'supplier-1', name: 'Reliable Supply' }, { id: 'supplier-2', name: 'Cheapest Shop' }]} onCompare={vi.fn().mockResolvedValue(options)} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('SKU'), { target: { value: 'sku-1' } });
    expect(await screen.findByText('Linked sample passed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create draft purchase order' })).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/Reliable Supply/));
    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create draft purchase order' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ supplierId: 'supplier-1', items: [expect.objectContaining({ skuId: 'sku-1', supplierProductId: 'rel-1', quantityOrdered: '5' })] }));
  });
});
