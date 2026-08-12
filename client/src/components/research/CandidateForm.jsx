import { useState } from 'react';

export default function CandidateForm({ categories = [], initialValue, onSubmit, submitting = false }) {
  const [form, setForm] = useState({
    name: initialValue?.name ?? '',
    brandName: initialValue?.brand_name ?? '',
    categoryId: initialValue?.category_id ?? '',
    marketplaceUrl: initialValue?.marketplace_url ?? '',
    description: initialValue?.description ?? '',
    modelNumber: initialValue?.model_number ?? '',
    gtin: initialValue?.gtin ?? '',
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
      description: form.description || null,
      modelNumber: form.modelNumber || null,
      gtin: form.gtin || null,
      notes: form.notes || null,
      ...(!initialValue ? { status: 'research' } : {}),
    });
  }

  return (
    <form className="catalog-form research-form" onSubmit={submit}>
      <section className="form-section">
        <div><p className="eyebrow">Product idea</p><h2>What are you researching?</h2><p>Start with the useful basics. Supplier, Noon, economics, and sample details live in the candidate workspace.</p></div>
        <div className="form-grid two-columns">
          <label>Candidate name<input required maxLength="200" value={form.name} onChange={(event) => update('name', event.target.value)} /></label>
          <label>Candidate brand<input maxLength="160" value={form.brandName} onChange={(event) => update('brandName', event.target.value)} /></label>
          <label>Category<select value={form.categoryId} onChange={(event) => update('categoryId', event.target.value)}><option value="">Uncategorized</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label className="span-two">Description<textarea rows="3" value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="What is it, and what problem does it solve?" /></label>
          <details className="more-details span-two"><summary>More details <span>Optional</span></summary><div className="form-grid two-columns">
            <label>Model number<input maxLength="120" value={form.modelNumber} onChange={(event) => update('modelNumber', event.target.value)} /></label>
            <label>Barcode / GTIN<input inputMode="numeric" pattern="[0-9]{8,14}" value={form.gtin} onChange={(event) => update('gtin', event.target.value)} /></label>
            <label className="span-two">Primary marketplace URL<input type="url" value={form.marketplaceUrl} onChange={(event) => update('marketplaceUrl', event.target.value)} placeholder="https://…" /></label>
            <label className="span-two">Research notes<textarea rows="4" value={form.notes} onChange={(event) => update('notes', event.target.value)} /></label>
          </div></details>
        </div>
      </section>
      <div className="form-actions"><a className="secondary-button" href="#research">Cancel</a><button className="primary-button" disabled={submitting}>{submitting ? 'Saving…' : initialValue ? 'Save candidate' : 'Create candidate'}</button></div>
    </form>
  );
}
