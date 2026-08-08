import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ReceivingForm from './ReceivingForm.jsx';

const purchaseOrder = {
  id: 'po-1',
  po_number: 'PO-001',
  order_date: '2026-08-01',
  status: 'ordered',
  items: [{
    id: 'line-1',
    sku_code: 'SKU-001',
    product_name: 'Mouse',
    variant_name: 'Black',
    quantity_ordered: '10.0000',
    quantity_received: '6.0000',
    remaining_quantity: '4.0000',
  }],
};

afterEach(cleanup);

describe('ReceivingForm', () => {
  it('submits accepted and rejected quantities after review', () => {
    const onSubmit = vi.fn();
    render(
      <ReceivingForm
        purchaseOrder={purchaseOrder}
        locations={[{ id: 'location-1', name: 'Main', code: 'MAIN' }]}
        onSubmit={onSubmit}
        submitting={false}
        error={null}
      />,
    );
    fireEvent.change(screen.getByLabelText('Receiving location'), { target: { value: 'location-1' } });
    fireEvent.change(screen.getByLabelText('Accepted quantity SKU-001'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Rejected quantity SKU-001'), { target: { value: '1' } });
    fireEvent.click(screen.getByLabelText(/I reviewed/));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm goods receipt' }));

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      locationId: 'location-1',
      items: [{
        purchaseOrderItemId: 'line-1',
        quantityReceived: '3',
        quantityRejected: '1',
      }],
    });
  });

  it('prevents an obvious over-receipt in the browser', () => {
    const onSubmit = vi.fn();
    render(
      <ReceivingForm
        purchaseOrder={purchaseOrder}
        locations={[{ id: 'location-1', name: 'Main', code: 'MAIN' }]}
        onSubmit={onSubmit}
        submitting={false}
        error={null}
      />,
    );
    fireEvent.change(screen.getByLabelText('Receiving location'), { target: { value: 'location-1' } });
    fireEvent.change(screen.getByLabelText('Accepted quantity SKU-001'), { target: { value: '5' } });
    fireEvent.click(screen.getByLabelText(/I reviewed/));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm goods receipt' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Accepted quantity SKU-001')).toBeInvalid();
  });
});
