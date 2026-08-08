import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TransferForm from './TransferForm.jsx';

const locations = [
  { id: 'source', name: 'Home Storage' },
  { id: 'destination', name: 'Noon Fulfillment Center' },
];
const skus = [{ id: 'sku-1', sku_code: 'KB-01', product_name: 'Keyboard' }];

afterEach(cleanup);

describe('TransferForm', () => {
  it('creates a draft with route and positive item quantity', () => {
    const onSubmit = vi.fn();
    render(<TransferForm locations={locations} skus={skus} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Source'), { target: { value: 'source' } });
    fireEvent.change(screen.getByLabelText('Destination'), { target: { value: 'destination' } });
    fireEvent.change(screen.getByLabelText('SKU'), { target: { value: 'sku-1' } });
    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create draft transfer' }));

    expect(onSubmit).toHaveBeenCalledWith({
      transferNumber: undefined,
      sourceLocationId: 'source',
      destinationLocationId: 'destination',
      notes: null,
      items: [{ skuId: 'sku-1', quantity: '2' }],
    });
  });

  it('adds another item line without moving stock', () => {
    render(<TransferForm locations={locations} skus={skus} onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add line' }));
    expect(screen.getAllByLabelText('SKU')).toHaveLength(2);
    expect(screen.getByText(/Creating a draft does not move stock/)).toBeInTheDocument();
  });
});
