import { useState } from 'react';
import BusinessTerm from '../BusinessTerm.jsx';
import { money, percent, researchTerms } from './ResearchTerms.js';

const defaults = {
  supplierOptionId: '', currency: 'EGP', sellingPrice: '', supplierUnitCost: '',
  localTransportCost: '0', packagingCost: '0', referralFeePercentage: '0',
  referralFeeFixed: '0', fulfillmentFee: '0', shippingReimbursement: '0',
  advertisingCost: '0', estimatedReturnReserve: '0', otherVariableCosts: '0',
  targetMarginPercentage: '20', targetRoiPercentage: '25',
};

export default function UnitEconomicsCalculator({
  onCalculate,
  supplierOptions = [],
  plannedSellingPrice = '',
  plannedPriceCurrency = 'EGP',
}) {
  const initialSupplier = supplierOptions.find((option) => option.preferred);
  const [form, setForm] = useState({
    ...defaults,
    sellingPrice: plannedSellingPrice || '',
    currency: plannedPriceCurrency || 'EGP',
    supplierOptionId: initialSupplier?.id || '',
    supplierUnitCost: initialSupplier?.quoted_unit_cost || '',
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function selectSupplier(id) {
    const option = supplierOptions.find((item) => item.id === id);
    setForm((current) => ({ ...current, supplierOptionId: id, supplierUnitCost: option?.quoted_unit_cost || '' }));
  }

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const calculated = await onCalculate({ ...form, supplierOptionId: form.supplierOptionId || null });
      setResult(calculated);
    } catch (requestError) {
      setError(requestError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="workspace-card research-calculator">
      <div className="detail-card-heading"><div><p className="eyebrow">Uses Task 5 calculation engine</p><h2>Unit economics</h2></div><span className="status-pill active">Server calculated</span></div>
      {!plannedSellingPrice && <div className="attention-note">Set a planned selling price in Marketplace before relying on this calculation.</div>}
      <form onSubmit={submit}>
        <div className="economics-core-fields">
          {supplierOptions.length > 0 && <label>Selected supplier<select required value={form.supplierOptionId} onChange={(event) => selectSupplier(event.target.value)}><option value="">Choose supplier quote</option>{supplierOptions.map((option) => <option key={option.id} value={option.id}>{option.supplier_name || option.lead_name} · {money(option.quoted_unit_cost, option.currency)}</option>)}</select></label>}
          <label>Supplier unit cost<input required readOnly={supplierOptions.length > 0} type="number" min="0" step="0.0001" value={form.supplierUnitCost} onChange={(event) => update('supplierUnitCost', event.target.value)} /></label>
          <label>Selling price<input required readOnly={Boolean(plannedSellingPrice)} type="number" min="0.0001" step="0.0001" value={form.sellingPrice} onChange={(event) => update('sellingPrice', event.target.value)} /></label>
          <label>Currency<input required readOnly={Boolean(plannedSellingPrice)} pattern="[A-Za-z]{3}" value={form.currency} onChange={(event) => update('currency', event.target.value.toUpperCase())} /></label>
        </div>

        <details className="more-details" open>
          <summary>Calculation assumptions <span>Visible and editable</span></summary>
          <div className="form-grid four-columns">
            {[
              ['referralFeePercentage', 'Marketplace fee %'], ['referralFeeFixed', 'Marketplace fixed fee'],
              ['fulfillmentFee', 'Fulfillment / shipping'], ['packagingCost', 'Packaging'],
              ['localTransportCost', 'Local transport'], ['advertisingCost', 'Advertising'],
              ['estimatedReturnReserve', 'Return allowance'], ['otherVariableCosts', 'Other variable costs'],
              ['shippingReimbursement', 'Shipping reimbursement'], ['targetMarginPercentage', 'Target margin %'],
              ['targetRoiPercentage', 'Target ROI %'],
            ].map(([field, label]) => <label key={field}>{field === 'estimatedReturnReserve' ? <BusinessTerm term={label} explanation={researchTerms['Estimated Return Reserve']} /> : label}<input required type="number" min="0" step="0.0001" value={form[field]} onChange={(event) => update(field, event.target.value)} /></label>)}
          </div>
        </details>
        {error && <div className="form-error" role="alert">{error.message}</div>}
        <button className="primary-button" disabled={submitting}>{submitting ? 'Calculating…' : 'Calculate and save'}</button>
      </form>
      {result && <div className="economics-results" aria-label="Unit economics results">
        <article><span>Purchase cost</span><strong>{money(result.supplier_unit_cost, result.currency)}</strong></article>
        <article><span>Total variable cost</span><strong>{money(result.total_variable_cost, result.currency)}</strong></article>
        <article><span><BusinessTerm term="Contribution Profit" explanation={researchTerms['Contribution Profit']} /></span><strong>{money(result.net_contribution, result.currency)}</strong></article>
        <article><span><BusinessTerm term="Margin" explanation={researchTerms.Margin} /></span><strong>{percent(result.net_margin_percentage)}</strong></article>
        <article><span><BusinessTerm term="ROI" explanation={researchTerms.ROI} /></span><strong>{percent(result.roi_percentage)}</strong></article>
        <article><span><BusinessTerm term="Break-even" explanation={researchTerms['Break-even']} /></span><strong>{money(result.break_even_price, result.currency)}</strong></article>
        <article><span>Maximum purchase · margin target</span><strong>{money(result.max_purchase_price_for_target_margin, result.currency)}</strong></article>
        <article><span>Maximum purchase · ROI target</span><strong>{money(result.max_purchase_price_for_target_roi, result.currency)}</strong></article>
      </div>}
      {result && <p className="form-note">Marketplace fees, fulfillment, packaging, transport, advertising, return allowance, and other variable costs are included above. Assumptions are stored with every calculation.</p>}
    </section>
  );
}
