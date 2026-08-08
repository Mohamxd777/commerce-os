import { useState } from 'react';
import BusinessTerm from '../BusinessTerm.jsx';
import { purchasingTerms } from './PurchasingTerms.js';

function initialValues(initial) {
  return {
    name: initial?.name ?? '',
    legalName: initial?.legal_name ?? '',
    contactPerson: initial?.contact_person ?? '',
    phone: initial?.phone ?? '',
    email: initial?.email ?? '',
    websiteUrl: initial?.website_url ?? '',
    address: initial?.address ?? '',
    taxNumber: initial?.tax_number ?? '',
    notes: initial?.notes ?? '',
    paymentTermsDays: initial?.payment_terms_days ?? '',
    preferredCurrency: initial?.preferred_currency ?? 'EGP',
    isActive: initial?.is_active ?? true,
  };
}

export default function SupplierForm({ initial, onSubmit, submitting, error }) {
  const [form, setForm] = useState(() => initialValues(initial));

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function submit(event) {
    event.preventDefault();
    onSubmit({
      name: form.name,
      legalName: form.legalName || null,
      contactPerson: form.contactPerson || null,
      phone: form.phone || null,
      email: form.email || null,
      websiteUrl: form.websiteUrl || null,
      address: form.address || null,
      taxNumber: form.taxNumber || null,
      notes: form.notes || null,
      paymentTermsDays: form.paymentTermsDays === '' ? null : Number(form.paymentTermsDays),
      preferredCurrency: form.preferredCurrency.toUpperCase(),
      isActive: form.isActive,
    });
  }

  return (
    <form className="purchasing-form" onSubmit={submit}>
      <section className="form-section">
        <div className="section-number">1</div>
        <div className="form-section-content">
          <div className="form-section-heading">
            <div><p className="eyebrow">Identity</p><h2>Supplier details</h2></div>
            <p>Use the supplier’s recognizable trading name. Similar spacing and capitalization are treated as duplicates.</p>
          </div>
          <div className="form-grid two-columns">
            <label>Supplier name<input required value={form.name} onChange={(event) => update('name', event.target.value)} /></label>
            <label>Legal name<input value={form.legalName} onChange={(event) => update('legalName', event.target.value)} /></label>
            <label>Contact person<input value={form.contactPerson} onChange={(event) => update('contactPerson', event.target.value)} /></label>
            <label>Phone<input type="tel" value={form.phone} onChange={(event) => update('phone', event.target.value)} /></label>
            <label>Email<input type="email" value={form.email} onChange={(event) => update('email', event.target.value)} /></label>
            <label>Website<input type="url" value={form.websiteUrl} onChange={(event) => update('websiteUrl', event.target.value)} /></label>
          </div>
        </div>
      </section>

      <section className="form-section">
        <div className="section-number">2</div>
        <div className="form-section-content">
          <div className="form-section-heading">
            <div><p className="eyebrow">Commercial defaults</p><h2>Terms and currency</h2></div>
          </div>
          <div className="form-grid three-columns">
            <label><BusinessTerm term="Payment Terms" explanation={purchasingTerms['Payment Terms']} /><input aria-label="Payment terms days" type="number" min="0" value={form.paymentTermsDays} onChange={(event) => update('paymentTermsDays', event.target.value)} placeholder="30 days" /></label>
            <label>Preferred currency<input required minLength="3" maxLength="3" value={form.preferredCurrency} onChange={(event) => update('preferredCurrency', event.target.value.toUpperCase())} /></label>
            <label className="checkbox-label"><input type="checkbox" checked={form.isActive} onChange={(event) => update('isActive', event.target.checked)} />Active supplier</label>
          </div>
          <div className="form-grid two-columns">
            <label>Tax number<input value={form.taxNumber} onChange={(event) => update('taxNumber', event.target.value)} /></label>
            <label>Address<textarea value={form.address} onChange={(event) => update('address', event.target.value)} /></label>
          </div>
          <label>Internal notes<textarea value={form.notes} onChange={(event) => update('notes', event.target.value)} /></label>
        </div>
      </section>

      {error && <div className="form-error" role="alert">{error.message}</div>}
      <div className="form-actions">
        <a className="text-button" href="#suppliers">Cancel</a>
        <button className="primary-button" disabled={submitting}>{submitting ? 'Saving…' : 'Save supplier'}</button>
      </div>
    </form>
  );
}
