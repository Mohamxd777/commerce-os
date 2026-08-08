import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ProductForm from './ProductForm.jsx';

const brands = [{ id: 'brand-1', name: 'Logitech' }];
const categories = [{ id: 'category-1', name: 'Mouse', path: 'Accessories > Mouse' }];

afterEach(cleanup);

describe('ProductForm', () => {
  it('builds an editable SKU suggestion and submits the reviewed structure', async () => {
    const onSubmit = vi.fn();

    render(
      <ProductForm
        brands={brands}
        categories={categories}
        onCreateBrand={vi.fn()}
        onSubmit={onSubmit}
        submitting={false}
        error={null}
      />,
    );

    fireEvent.change(screen.getByLabelText('Brand'), { target: { value: 'brand-1' } });
    fireEvent.change(screen.getByLabelText(/Category/), { target: { value: 'category-1' } });
    fireEvent.change(screen.getByLabelText(/Product name/), { target: { value: 'G102 Lightsync' } });
    fireEvent.change(screen.getByLabelText('Model number'), { target: { value: 'G102' } });
    fireEvent.change(screen.getByLabelText(/Variant name/), { target: { value: 'Black' } });

    fireEvent.click(screen.getByRole('button', { name: /Use suggestion: MOU-LOG-G102-BLK/ }));
    expect(screen.getByLabelText(/SKU code/)).toHaveValue('MOU-LOG-G102-BLK');

    fireEvent.click(screen.getByRole('button', { name: /save product/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0][0].variants[0].skus[0].skuCode).toBe('MOU-LOG-G102-BLK');
    expect(onSubmit.mock.calls[0][0].categoryId).toBe('category-1');
  });

  it('supports adding multiple variants', () => {
    render(
      <ProductForm
        brands={brands}
        categories={categories}
        onCreateBrand={vi.fn()}
        onSubmit={vi.fn()}
        submitting={false}
        error={null}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add another variant' }));
    expect(screen.getByText('Variant 2')).toBeInTheDocument();
  });
});
