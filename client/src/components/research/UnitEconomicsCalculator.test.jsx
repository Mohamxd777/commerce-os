import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import UnitEconomicsCalculator from './UnitEconomicsCalculator.jsx';

afterEach(cleanup);

describe('UnitEconomicsCalculator', () => {
  it('sends decimal strings to the server and renders authoritative outputs', async () => {
    const onCalculate = vi.fn().mockResolvedValue({
      currency: 'EGP', total_variable_cost: '765.0000', net_contribution: '235.0000',
      net_margin_percentage: '23.5000', roi_percentage: '30.7190',
      break_even_price: '738.8889', max_purchase_price_for_target_margin: '535.0000',
      max_purchase_price_for_target_roi: '535.0000',
    });
    render(<UnitEconomicsCalculator onCalculate={onCalculate} />);
    fireEvent.change(screen.getByLabelText('Selling price'), { target: { value: '1000' } });
    fireEvent.change(screen.getByLabelText('Supplier unit cost'), { target: { value: '500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Calculate and save' }));
    await waitFor(() => expect(onCalculate).toHaveBeenCalled());
    expect(onCalculate.mock.calls[0][0].sellingPrice).toBe('1000');
    expect(await screen.findByText('23.50%')).toBeInTheDocument();
    expect(screen.getByText('30.72%')).toBeInTheDocument();
  });
});
