import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SupplierForm from './SupplierForm.jsx';

afterEach(cleanup);

describe('SupplierForm', () => {
  it('submits normalized supplier contact and commercial defaults', () => {
    const onSubmit = vi.fn();
    render(<SupplierForm onSubmit={onSubmit} submitting={false} error={null} />);

    fireEvent.change(screen.getByLabelText('Supplier name'), { target: { value: 'Nile Supply' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'orders@nile.test' } });
    fireEvent.change(screen.getByLabelText('Payment terms days'), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText('Preferred currency'), { target: { value: 'usd' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save supplier' }));

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      name: 'Nile Supply',
      email: 'orders@nile.test',
      paymentTermsDays: 30,
      preferredCurrency: 'USD',
      isActive: true,
    });
  });

  it('shows the Arabic payment-terms explanation', () => {
    render(<SupplierForm onSubmit={vi.fn()} submitting={false} error={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Explain Payment Terms' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent('المدة أو الشروط المتفق عليها');
  });
});
