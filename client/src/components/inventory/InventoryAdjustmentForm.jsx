import { useMemo, useState } from 'react';
import BusinessTerm from '../BusinessTerm.jsx';
import { bucketLabels, inventoryTerms } from './InventoryTerms.js';

const initial = {
  skuId: '',
  locationId: '',
  direction: 'in',
  stockBucket: 'available',
  destinationBucket: 'quarantine',
  quantity: '1',
  reason: '',
  notes: '',
};

export default function InventoryAdjustmentForm({ skus, locations, onSubmit, submitting = false }) {
  const [form, setForm] = useState(initial);
  const isMove = form.direction === 'move';
  const effect = useMemo(() => {
    if (!form.quantity) return 'Enter a quantity to preview the ledger effect.';
    if (isMove) {
      return `-${form.quantity} ${bucketLabels[form.stockBucket]} and +${form.quantity} ${bucketLabels[form.destinationBucket]}. Total physical stock does not change.`;
    }
    return `${form.direction === 'in' ? '+' : '-'}${form.quantity} ${bucketLabels[form.stockBucket]}. This creates an immutable ledger movement.`;
  }, [form, isMove]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function submit(event) {
    event.preventDefault();
    const message = 'Confirm inventory adjustment?\n\n' + effect + '\n\nCorrections require a new movement; this history cannot be edited.';
    if (!window.confirm(message)) return;
    onSubmit({
      ...form,
      destinationBucket: isMove ? form.destinationBucket : undefined,
      notes: form.notes || null,
    });
  }

  return (
    <form className="purchasing-form inventory-action-form" onSubmit={submit}>
      <section className="form-section">
        <span className="section-number">1</span>
        <div className="form-section-content">
          <div className="form-section-heading">
            <div><h2>Stock identity</h2><p>Select the exact SKU and physical location.</p></div>
          </div>
          <div className="form-grid">
            <label>SKU<select required value={form.skuId} onChange={(event) => update('skuId', event.target.value)}><option value="">Choose SKU</option>{skus.map((sku) => <option key={sku.id} value={sku.id}>{sku.sku_code} · {sku.product_name}</option>)}</select></label>
            <label>Location<select required value={form.locationId} onChange={(event) => update('locationId', event.target.value)}><option value="">Choose location</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
          </div>
        </div>
      </section>
      <section className="form-section">
        <span className="section-number">2</span>
        <div className="form-section-content">
          <div className="form-section-heading"><div><h2><BusinessTerm term="Stock Adjustment" explanation={inventoryTerms['Stock Adjustment']} /></h2><p>Record a count correction or an auditable bucket change.</p></div></div>
          <div className="form-grid four-columns">
            <label>Action<select value={form.direction} onChange={(event) => update('direction', event.target.value)}><option value="in">Add found stock</option><option value="out">Remove missing stock</option><option value="move">Move between buckets</option></select></label>
            <label>From / affected bucket<select value={form.stockBucket} onChange={(event) => update('stockBucket', event.target.value)}>{Object.entries(bucketLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            {isMove && <label>Destination bucket<select value={form.destinationBucket} onChange={(event) => update('destinationBucket', event.target.value)}>{Object.entries(bucketLabels).filter(([value]) => value !== form.stockBucket).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
            <label>Quantity<input required min="0.0001" step="0.0001" type="number" value={form.quantity} onChange={(event) => update('quantity', event.target.value)} /></label>
          </div>
          <div className="immutable-note"><strong>Ledger preview</strong><span>{effect}</span></div>
        </div>
      </section>
      <section className="form-section">
        <span className="section-number">3</span>
        <div className="form-section-content">
          <div className="form-section-heading"><div><h2>Audit explanation</h2><p>Explain why the recorded stock changed.</p></div></div>
          <label>Reason<input required minLength="3" maxLength="240" value={form.reason} onChange={(event) => update('reason', event.target.value)} placeholder="Cycle count correction, damage found, inspection…" /></label>
          <label>Notes<textarea value={form.notes} onChange={(event) => update('notes', event.target.value)} /></label>
          <div className="form-actions"><a className="secondary-button" href="#inventory/stock">Cancel</a><button className="primary-button" disabled={submitting}>{submitting ? 'Recording…' : 'Confirm adjustment'}</button></div>
        </div>
      </section>
    </form>
  );
}
