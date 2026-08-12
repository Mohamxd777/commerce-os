import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import QuickCaptureForm from './QuickCaptureForm.jsx';

afterEach(cleanup);

describe('QuickCaptureForm', () => {
  it('submits only product, supplier, and unit price as required workflow data', () => {
    const onSubmit = vi.fn();
    render(<QuickCaptureForm onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('Product description / name'), { target: { value: 'USB-C Hub 3-in-1' } });
    fireEvent.change(screen.getByLabelText('Supplier name'), { target: { value: 'Al Alameya - Ahmed El Farghaly' } });
    fireEvent.change(screen.getByLabelText('Unit price'), { target: { value: '130' } });
    const photo = new File(['image'], 'hub.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText(/Product photo/), { target: { files: [photo] } });
    fireEvent.submit(screen.getByRole('button', { name: 'Save as Needs Research' }).closest('form'));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      name: 'USB-C Hub 3-in-1', supplierName: 'Al Alameya - Ahmed El Farghaly',
      unitPrice: '130', currency: 'EGP',
      photoFile: photo,
    }));
  });
});
