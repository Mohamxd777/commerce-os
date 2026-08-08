import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BusinessTerm from './BusinessTerm.jsx';

describe('BusinessTerm', () => {
  it('reveals the Arabic explanation when activated', () => {
    render(<BusinessTerm term="ROI" explanation="العائد على الاستثمار" />);

    fireEvent.click(screen.getByRole('button', { name: 'Explain ROI' }));

    expect(screen.getByRole('tooltip')).toHaveTextContent('العائد على الاستثمار');
  });
});
