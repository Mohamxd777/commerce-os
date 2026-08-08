import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { researchApi } from '../../api/researchApi.js';
import ResearchComparisonPage from './ResearchComparisonPage.jsx';

vi.mock('../../api/researchApi.js', () => ({
  researchApi: { listCandidates: vi.fn(), compare: vi.fn() },
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('ResearchComparisonPage', () => {
  it('compares only candidates selected by the user', async () => {
    const candidates = [{ id: 'one', name: 'USB-C Hub' }, { id: 'two', name: 'Laptop Stand' }];
    researchApi.listCandidates.mockResolvedValue({ data: candidates });
    researchApi.compare.mockResolvedValue({ data: [
      { ...candidates[0], status: 'approved', market_currency: 'EGP', net_margin_percentage: '20', roi_percentage: '25' },
      { ...candidates[1], status: 'research', market_currency: 'EGP', net_margin_percentage: '15', roi_percentage: '18' },
    ] });
    render(<ResearchComparisonPage organizationId="org-1" />);
    fireEvent.click(await screen.findByLabelText('USB-C Hub'));
    fireEvent.click(screen.getByLabelText('Laptop Stand'));
    await waitFor(() => expect(researchApi.compare).toHaveBeenCalledWith('org-1', ['one', 'two']));
    expect(await screen.findByText('20.00%')).toBeInTheDocument();
  });
});
