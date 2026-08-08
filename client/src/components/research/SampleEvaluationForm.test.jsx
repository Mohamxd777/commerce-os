import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SampleEvaluationForm from './SampleEvaluationForm.jsx';

afterEach(cleanup);

describe('SampleEvaluationForm', () => {
  it('supports accessory presets and arbitrary product-specific checks', () => {
    const onSubmit = vi.fn();
    render(<SampleEvaluationForm supplierOptions={[{ id: 'option-1', lead_name: 'Lead One' }]} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('Supplier option'), { target: { value: 'option-1' } });
    fireEvent.click(screen.getByRole('button', { name: '+ USB-C power delivery' }));
    fireEvent.change(screen.getByLabelText('USB-C power delivery result'), { target: { value: 'true' } });
    fireEvent.change(screen.getByLabelText('Custom checklist item'), { target: { value: 'Color accuracy' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add check' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save sample evaluation' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      supplierOptionId: 'option-1',
      checklist: [
        expect.objectContaining({ label: 'USB-C power delivery', passed: true }),
        expect.objectContaining({ label: 'Color accuracy', passed: null }),
      ],
    }));
  });
});
