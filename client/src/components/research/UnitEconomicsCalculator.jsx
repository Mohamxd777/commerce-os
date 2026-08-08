import { useState } from 'react';
import BusinessTerm from '../BusinessTerm.jsx';
import { money, percent, researchTerms } from './ResearchTerms.js';

const initial = {
  currency: 'EGP', sellingPrice: '', supplierUnitCost: '', localTransportCost: '0',
  packagingCost: '0', referralFeePercentage: '0', referralFeeFixed: '0',
  fulfillmentFee: '0', shippingReimbursement: '0', advertisingCost: '0',
  estimatedReturnReserve: '0', otherVariableCosts: '0',
  targetMarginPercentage: '20', targetRoiPercentage: '25',
};

export default function UnitEconomicsCalculator({ onCalculate }) {
  const [form, setForm] = useState(initial);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const calculated = await onCalculate(form);
      setResult(calculated);
    } catch (requestError) {
      setError(requestError);
    } finally {
      setSubmitting(false);
    }
  }

  const inputs = [
    ['sellingPrice', 'Selling price'], ['supplierUnitCost', 'Supplier unit cost'],
    ['localTransportCost', 'Local transport'], ['packagingCost', 'Packaging'],
    ['referralFeePercentage', 'Referral fee %'], ['referralFeeFixed', 'Referral fixed fee'],
    ['fulfillmentFee', 'Fulfillment fee'], ['shippingReimbursement', 'Shipping reimbursement'],
    ['advertisingCost', 'Advertising'], ['estimatedReturnReserve', 'Estimated Return Reserve'],
    ['otherVariableCosts', 'Other variable costs'], ['targetMarginPercentage', 'Target margin %'],
    ['targetRoiPercentage', 'Target ROI %'],
  ];

  return (
    <section className="detail-card research-calculator">
      <div className="detail-card-heading"><div><p className="eyebrow">Server-calculated</p><h2>Unit economics</h2></div><span className="status-pill active">PostgreSQL NUMERIC</span></div>
      <form onSubmit={submit}>
        <div className="form-grid four-columns">
          <label>Currency<input required pattern="[A-Za-z]{3}" value={form.currency} onChange={(event) => update('currency', event.target.value.toUpperCase())} /></label>
          {inputs.map(([field, label]) => <label key={field}>{field === 'estimatedReturnReserve' ? <BusinessTerm term={label} explanation={researchTerms[label]} /> : label}<input required type="number" min="0" step="0.0001" value={form[field]} onChange={(event) => update(field, event.target.value)} /></label>)}
        </div>
        {error && <div className="form-error" role="alert">{error.message}</div>}
        <button className="primary-button" disabled={submitting}>{submitting ? 'Calculating…' : 'Calculate and save'}</button>
      </form>
      {result && <div className="economics-results" aria-label="Unit economics results">
        <article><span>Total variable cost</span><strong>{money(result.total_variable_cost, result.currency)}</strong></article>
        <article><span><BusinessTerm term="Contribution Profit" explanation={researchTerms['Contribution Profit']} /></span><strong>{money(result.net_contribution, result.currency)}</strong></article>
        <article><span><BusinessTerm term="Net Margin" explanation={researchTerms['Net Margin']} /></span><strong>{percent(result.net_margin_percentage)}</strong></article>
        <article><span><BusinessTerm term="ROI" explanation={researchTerms.ROI} /></span><strong>{percent(result.roi_percentage)}</strong></article>
        <article><span><BusinessTerm term="Break-even" explanation={researchTerms['Break-even']} /></span><strong>{money(result.break_even_price, result.currency)}</strong></article>
        <article><span>Max purchase · target margin</span><strong>{money(result.max_purchase_price_for_target_margin, result.currency)}</strong></article>
        <article><span>Max purchase · target ROI</span><strong>{money(result.max_purchase_price_for_target_roi, result.currency)}</strong></article>
      </div>}
    </section>
  );
}
