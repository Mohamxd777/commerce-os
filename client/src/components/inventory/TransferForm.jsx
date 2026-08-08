import { useState } from 'react';

export default function TransferForm({ locations, skus, onSubmit, submitting = false }) {
  const [form, setForm] = useState({
    transferNumber: '',
    sourceLocationId: '',
    destinationLocationId: '',
    notes: '',
    items: [{ skuId: '', quantity: '1' }],
  });

  function updateItem(index, field, value) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item),
    }));
  }

  function submit(event) {
    event.preventDefault();
    onSubmit({
      ...form,
      transferNumber: form.transferNumber || undefined,
      notes: form.notes || null,
    });
  }

  return (
    <form className="purchasing-form" onSubmit={submit}>
      <section className="form-section"><span className="section-number">1</span><div className="form-section-content"><div className="form-section-heading"><div><h2>Transfer route</h2><p>Stock leaves the source at shipment and reaches the destination only at receipt.</p></div></div><div className="form-grid three-columns"><label>Transfer number<input value={form.transferNumber} onChange={(event) => setForm({ ...form, transferNumber: event.target.value })} placeholder="Generated when empty" /></label><label>Source<select required value={form.sourceLocationId} onChange={(event) => setForm({ ...form, sourceLocationId: event.target.value })}><option value="">Choose source</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label><label>Destination<select required value={form.destinationLocationId} onChange={(event) => setForm({ ...form, destinationLocationId: event.target.value })}><option value="">Choose destination</option>{locations.filter((location) => location.id !== form.sourceLocationId).map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label></div></div></section>
      <section className="form-section"><span className="section-number">2</span><div className="form-section-content"><div className="form-section-heading"><div><h2>Transfer items</h2><p>Shipment is rejected transactionally if any quantity exceeds source available stock.</p></div><button type="button" className="secondary-button" onClick={() => setForm({ ...form, items: [...form.items, { skuId: '', quantity: '1' }] })}>Add line</button></div><div className="po-line-list">{form.items.map((item, index) => <div className="po-line-card" key={index}><div className="form-grid three-columns"><label>SKU<select required value={item.skuId} onChange={(event) => updateItem(index, 'skuId', event.target.value)}><option value="">Choose SKU</option>{skus.map((sku) => <option key={sku.id} value={sku.id}>{sku.sku_code} · {sku.product_name}</option>)}</select></label><label>Quantity<input required type="number" min="0.0001" step="0.0001" value={item.quantity} onChange={(event) => updateItem(index, 'quantity', event.target.value)} /></label>{form.items.length > 1 && <button type="button" className="text-button danger" onClick={() => setForm({ ...form, items: form.items.filter((_, itemIndex) => itemIndex !== index) })}>Remove line</button>}</div></div>)}</div></div></section>
      <section className="form-section"><span className="section-number">3</span><div className="form-section-content"><div className="form-section-heading"><div><h2>Notes and review</h2><p>Creating a draft does not move stock.</p></div></div><label>Notes<textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label><div className="immutable-note"><strong>Workflow</strong><span>Draft → Ship (source decreases) → In transit → Receive (destination increases).</span></div><div className="form-actions"><a className="secondary-button" href="#inventory/transfers">Cancel</a><button className="primary-button" disabled={submitting}>{submitting ? 'Creating…' : 'Create draft transfer'}</button></div></div></section>
    </form>
  );
}
