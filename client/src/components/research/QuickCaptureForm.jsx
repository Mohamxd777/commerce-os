import { useState } from 'react';
import BusinessTerm from '../BusinessTerm.jsx';
import { researchTerms } from './ResearchTerms.js';

export default function QuickCaptureForm({ suppliers = [], categories = [], onSubmit, submitting = false }) {
  const [form, setForm] = useState({
    name: '', supplierId: '', supplierName: '', unitPrice: '', currency: 'EGP',
    brandName: '', modelNumber: '', gtin: '', categoryId: '', moq: '1',
    warrantyText: '', invoiceAvailable: '', notes: '', photoReference: '',
  });
  const [photoFile, setPhotoFile] = useState(null);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function submit(event) {
    event.preventDefault();
    onSubmit({
      name: form.name,
      supplierId: form.supplierId || null,
      supplierName: form.supplierId ? null : form.supplierName || null,
      unitPrice: form.unitPrice,
      currency: form.currency,
      brandName: form.brandName || null,
      modelNumber: form.modelNumber || null,
      gtin: form.gtin || null,
      categoryId: form.categoryId || null,
      moq: form.moq,
      warrantyText: form.warrantyText || null,
      invoiceAvailable: form.invoiceAvailable === '' ? null : form.invoiceAvailable === 'yes',
      notes: form.notes || null,
      photoReference: form.photoReference || null,
      photoFile,
    });
  }

  return (
    <form className="quick-capture-form" onSubmit={submit}>
      <section className="quick-capture-core">
        <label>Product description / name<input autoFocus required maxLength="200" value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="e.g. USB-C Hub 5-in-1" /></label>
        <label>Supplier<select value={form.supplierId} onChange={(event) => update('supplierId', event.target.value)}><option value="">Enter a shop or contact name</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
        {!form.supplierId && <label>Supplier name<input required value={form.supplierName} onChange={(event) => update('supplierName', event.target.value)} placeholder="Shop or contact" /></label>}
        <label>Unit price<div className="input-pair"><input required type="number" min="0" step="0.0001" inputMode="decimal" value={form.unitPrice} onChange={(event) => update('unitPrice', event.target.value)} /><input aria-label="Currency" required pattern="[A-Za-z]{3}" value={form.currency} onChange={(event) => update('currency', event.target.value.toUpperCase())} /></div></label>
        <label>Product photo<input required type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" capture="environment" onChange={(event) => setPhotoFile(event.target.files?.[0] || null)} /><small>PNG or JPEG. Stored in managed local app data.</small></label>
      </section>

      <details className="more-details">
        <summary>More details <span>Optional</span></summary>
        <div className="form-grid two-columns">
          <label>Brand<input maxLength="160" value={form.brandName} onChange={(event) => update('brandName', event.target.value)} /></label>
          <label>Model number<input maxLength="120" value={form.modelNumber} onChange={(event) => update('modelNumber', event.target.value)} /></label>
          <label>Barcode / GTIN<input inputMode="numeric" pattern="[0-9]{8,14}" value={form.gtin} onChange={(event) => update('gtin', event.target.value)} /></label>
          <label>Category<select value={form.categoryId} onChange={(event) => update('categoryId', event.target.value)}><option value="">Uncategorized</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label><BusinessTerm term="MOQ" explanation={researchTerms.MOQ} /><input required type="number" min="0.0001" step="0.0001" value={form.moq} onChange={(event) => update('moq', event.target.value)} /></label>
          <label>Invoice<select value={form.invoiceAvailable} onChange={(event) => update('invoiceAvailable', event.target.value)}><option value="">Not checked</option><option value="yes">Available</option><option value="no">Not available</option></select></label>
          <label className="span-two">Warranty<input maxLength="500" value={form.warrantyText} onChange={(event) => update('warrantyText', event.target.value)} placeholder="e.g. 12 months shop warranty" /></label>
          <label className="span-two">Photo reference URL<input type="url" value={form.photoReference} onChange={(event) => update('photoReference', event.target.value)} placeholder="Optional external photo link" /></label>
          <label className="span-two">Notes<textarea rows="3" value={form.notes} onChange={(event) => update('notes', event.target.value)} /></label>
        </div>
      </details>

      <div className="form-actions"><a className="secondary-button" href="#research">Cancel</a><button className="primary-button" disabled={submitting}>{submitting ? 'Saving…' : 'Save as Needs Research'}</button></div>
    </form>
  );
}
