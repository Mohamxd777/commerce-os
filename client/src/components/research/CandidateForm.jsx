import { useState } from 'react';

export default function CandidateForm({ categories = [], initialValue, onSubmit, submitting = false }) {
  const [form, setForm] = useState({
    name: initialValue?.name ?? '',
    brandName: initialValue?.brand_name ?? '',
    categoryId: initialValue?.category_id ?? '',
    marketplaceUrl: initialValue?.marketplace_url ?? '',
    notes: initialValue?.notes ?? '',
  });

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function submit(event) {
    event.preventDefault();
    onSubmit({
      name: form.name,
      brandName: form.brandName || null,
      categoryId: form.categoryId || null,
      marketplaceUrl: form.marketplaceUrl || null,
      notes: form.notes || null,
      ...(!initialValue ? { status: 'research' } : {}),
    });
  }

  return (
    <form className="catalog-form research-form" onSubmit={submit}>
      <section className="form-section">
        <div><p className="eyebrow">Candidate identity</p><h2>Research subject</h2><p>Keep it separate from the operational catalog until the launch decision is approved.</p></div>
        <div className="form-grid two-columns">
          <label>Candidate name<input required maxLength="200" value={form.name} onChange={(event) => update('name', event.target.value)} /></label>
          <label>Candidate brand<input maxLength="160" value={form.brandName} onChange={(event) => update('brandName', event.target.value)} /></label>
          <label>Category<select value={form.categoryId} onChange={(event) => update('categoryId', event.target.value)}><option value="">Uncategorized</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label>Primary marketplace URL<input type="url" value={form.marketplaceUrl} onChange={(event) => update('marketplaceUrl', event.target.value)} placeholder="https://…" /></label>
          <label className="span-two">Research notes<textarea rows="5" value={form.notes} onChange={(event) => update('notes', event.target.value)} /></label>
        </div>
      </section>
      <div className="form-actions"><a className="secondary-button" href="#research/candidates">Cancel</a><button className="primary-button" disabled={submitting}>{submitting ? 'Saving…' : initialValue ? 'Save candidate' : 'Create candidate'}</button></div>
    </form>
  );
}
