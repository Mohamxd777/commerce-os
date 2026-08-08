import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import InventoryAdjustmentForm from './InventoryAdjustmentForm.jsx';

const skus = [{ id: 'sku-1', sku_code: 'MOUSE-01', product_name: 'Wireless Mouse' }];
const locations = [{ id: 'loc-1', name: 'Main Warehouse' }];

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('InventoryAdjustmentForm', () => {
  it('previews and submits an audited quarantine bucket movement', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onSubmit = vi.fn();
    render(<InventoryAdjustmentForm skus={skus} locations={locations} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('SKU'), { target: { value: 'sku-1' } });
    fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'loc-1' } });
    fireEvent.change(screen.getByLabelText('Action'), { target: { value: 'move' } });
    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Quality inspection' } });

    expect(screen.getByText(/-2 Available and \+2 Quarantine/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm adjustment' }));

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('cannot be edited'));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      skuId: 'sku-1',
      locationId: 'loc-1',
      direction: 'move',
      stockBucket: 'available',
      destinationBucket: 'quarantine',
      quantity: '2',
      reason: 'Quality inspection',
    }));
  });

  it('does not submit when confirmation is declined', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const onSubmit = vi.fn();
    render(<InventoryAdjustmentForm skus={skus} locations={locations} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm adjustment' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
