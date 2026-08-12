import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MarketplaceWorkspace from './MarketplaceWorkspace.jsx';

afterEach(cleanup);

describe('MarketplaceWorkspace', () => {
  it('saves planned price separately from observed Noon listing prices', () => {
    const onAddObservation = vi.fn();
    const onSavePlannedPrice = vi.fn();
    render(<MarketplaceWorkspace candidate={{ snapshots: [], observation_count: 0 }} onAddObservation={onAddObservation} onSavePlannedPrice={onSavePlannedPrice} />);
    fireEvent.change(screen.getByLabelText('Our planned selling price'), { target: { value: '299' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save planned price' }));
    expect(onSavePlannedPrice).toHaveBeenCalledWith({ plannedSellingPrice: '299', plannedPriceCurrency: 'EGP' });

    fireEvent.change(screen.getByLabelText('Listing URL'), { target: { value: 'https://www.noon.com/egypt-en/example' } });
    fireEvent.change(screen.getByLabelText('Selling price'), { target: { value: '279' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add observation' }));
    expect(onAddObservation).toHaveBeenCalledWith(expect.objectContaining({
      marketplace: 'Noon Egypt', sellingPrice: '279', listingUrl: 'https://www.noon.com/egypt-en/example',
    }));
  });
});
