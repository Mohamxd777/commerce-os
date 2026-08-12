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
    }), []);
  });

  it('keeps analyzed values in an editable preview and labels user changes', async () => {
    const onAnalyze = vi.fn().mockResolvedValue({
      analyzedAt: '2026-08-12T10:00:00.000Z', strategy: ['json_ld'], notFound: ['gtin'], warnings: [],
      values: { canonicalUrl: 'https://www.noon.com/item/p/', title: 'Auto hub', currentPrice: 250, originalPrice: null, currency: 'EGP', rating: 4.5, reviewCount: 10, seller: 'Seller', brand: 'Brand', recentSales: null, bestsellerRank: null, noonExpress: true, availability: 'InStock', model: 'H5', gtin: null, specifications: {}, imageUrls: [], mainImageUrl: null },
    });
    render(<MarketplaceWorkspace candidate={{ snapshots: [], observation_count: 0 }} onAnalyze={onAnalyze} onAddObservation={vi.fn()} onSavePlannedPrice={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Noon product URL'), { target: { value: 'https://www.noon.com/item/p/' } });
    fireEvent.click(screen.getByRole('button', { name: 'Analyze URL' }));
    expect(await screen.findByDisplayValue('Auto hub')).toBeInTheDocument();
    expect(screen.getAllByText('Auto').length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText(/Selling price/), { target: { value: '245' } });
    expect(screen.getAllByText('User edited').length).toBeGreaterThan(0);
  });
});
