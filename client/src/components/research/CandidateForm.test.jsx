import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CandidateForm from './CandidateForm.jsx';

afterEach(cleanup);

describe('CandidateForm', () => {
  it('creates a research-only candidate with safe nullable fields', () => {
    const onSubmit = vi.fn();
    render(<CandidateForm categories={[{ id: 'cat-1', name: 'Accessories' }]} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('Candidate name'), { target: { value: 'USB-C Hub' } });
    fireEvent.change(screen.getByLabelText('Candidate brand'), { target: { value: 'Nova' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'cat-1' } });
    fireEvent.change(screen.getByLabelText('Primary marketplace URL'), { target: { value: 'https://example.com/hub' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create candidate' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      name: 'USB-C Hub', brandName: 'Nova', categoryId: 'cat-1',
      marketplaceUrl: 'https://example.com/hub', status: 'research',
    }));
  });
});
