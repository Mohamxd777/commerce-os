import { useState } from 'react';
import BusinessTerm from '../BusinessTerm.jsx';
import { researchTerms } from './ResearchTerms.js';

const quantities = [1, 5, 10, 20, 50, 100];

export default function SupplierOptionForm({ suppliers = [], onSubmit, submitting = false }) {
  const [form, setForm] = useState({
    supplierId: '', leadName: '', modelVariant: '', quotedUnitCost: '', currency: 'EGP',
    samePriceAllQuantities: true, priceQty1: '', priceQty5: '', priceQty10: '',
    priceQty20: '', priceQty50: '', priceQty100: '', moq: '1', leadTimeDays: '0',
    warrantyText: '', defectiveUnitReplacement: '', invoiceAvailable: '',
    sampleAvailable: '', preferred: false, notes: '',
  });

  function update(field, value) { setForm((current) => ({ ...current, [field]: value })); }
  const availability = (value) => value === '' ? null : value === 'yes';

  function submit(event) {
    event.preventDefault();
    const body = {
      supplierId: form.supplierId || null,
      leadName: form.supplierId ? null : form.leadName || null,
      modelVariant: form.modelVariant || null,
      quotedUnitCost: form.quotedUnitCost,
      currency: form.currency,
      samePriceAllQuantities: form.samePriceAllQuantities,
      moq: form.moq,
      leadTimeDays: Number(form.leadTimeDays),
      warrantyText: form.warrantyText || null,
      defectiveUnitReplacement: availability(form.defectiveUnitReplacement),
      invoiceAvailable: availability(form.invoiceAvailable),
      sampleAvailable: availability(form.sampleAvailable),
      preferred: form.preferred,
      notes: form.notes || null,
    };
    for (const quantity of quantities) {
      body['priceQty' + quantity] = form.samePriceAllQuantities ? null : form['priceQty' + quantity] || null;
    }
    onSubmit(body);
  }

  return (
    <form className="embedded-form supplier-option-form" onSubmit={submit}>
      <div className="form-grid three-columns">
        <label>Supplier<select value={form.supplierId} onChange={(event) => update('supplierId', event.target.value)}><option value="">Enter a supplier lead</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
        {!form.supplierId && <label>Supplier name<input required value={form.leadName} onChange={(event) => update('leadName', event.target.value)} /></label>}
        <label>Model / variant<input maxLength="200" value={form.modelVariant} onChange={(event) => update('modelVariant', event.target.value)} /></label>
        <label>Unit cost<div className="input-pair"><input required type="number" min="0" step="0.0001" value={form.quotedUnitCost} onChange={(event) => update('quotedUnitCost', event.target.value)} /><input aria-label="Supplier currency" required pattern="[A-Za-z]{3}" value={form.currency} onChange={(event) => update('currency', event.target.value.toUpperCase())} /></div></label>
        <label><BusinessTerm term="MOQ" explanation={researchTerms.MOQ} /><input required type="number" min="0.0001" step="0.0001" value={form.moq} onChange={(event) => update('moq', event.target.value)} /></label>
        <label>Lead time (days)<input required type="number" min="0" value={form.leadTimeDays} onChange={(event) => update('leadTimeDays', event.target.value)} /></label>
      </div>

      <label className="checkbox-field same-price-toggle"><input type="checkbox" checked={form.samePriceAllQuantities} onChange={(event) => update('samePriceAllQuantities', event.target.checked)} />Same price at all quantities</label>
      {!form.samePriceAllQuantities && <div className="quantity-price-grid">{quantities.map((quantity) => <label key={quantity}>Qty {quantity}<input aria-label={'Price at quantity ' + quantity} type="number" min="0" step="0.0001" value={form['priceQty' + quantity]} onChange={(event) => update('priceQty' + quantity, event.target.value)} placeholder={form.quotedUnitCost || 'Price'} /></label>)}</div>}

      <details className="more-details">
        <summary>More supplier details <span>Useful when choosing the best option</span></summary>
        <div className="form-grid two-columns">
          <label className="span-two">Warranty<input maxLength="500" value={form.warrantyText} onChange={(event) => update('warrantyText', event.target.value)} /></label>
          {[['defectiveUnitReplacement', 'Defective-unit replacement'], ['invoiceAvailable', 'Invoice availability'], ['sampleAvailable', 'Sample availability']].map(([field, label]) => <label key={field}>{label}<select value={form[field]} onChange={(event) => update(field, event.target.value)}><option value="">Unknown</option><option value="yes">Yes</option><option value="no">No</option></select></label>)}
          <label className="checkbox-field"><input type="checkbox" checked={form.preferred} onChange={(event) => update('preferred', event.target.checked)} />Mark as best option</label>
          <label className="span-two">Notes<textarea rows="3" value={form.notes} onChange={(event) => update('notes', event.target.value)} /></label>
        </div>
      </details>
      <button className="primary-button" disabled={submitting}>{submitting ? 'Saving…' : 'Add supplier quote'}</button>
    </form>
  );
}
