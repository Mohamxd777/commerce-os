import { useMemo, useState } from 'react';

function nowPoNumber() {
  return 'PO-' + new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14) + '-' + String(Date.now()).slice(-5);
}

export default function ProductFirstPurchaseOrderForm({ skus, suppliers, onCompare, onSubmit, submitting, error }) {
  const [skuId, setSkuId] = useState('');
  const [options, setOptions] = useState([]);
  const [relationshipId, setRelationshipId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [loading, setLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState('');
  const selected = options.find((item) => item.id === relationshipId);
  const supplier = suppliers.find((item) => item.id === selected?.supplier_id);
  const sku = skus.find((item) => item.id === skuId);
  const subtotal = useMemo(() => Number(quantity || 0) * Number(selected?.current_unit_cost || 0), [quantity, selected]);

  async function chooseSku(value) {
    setSkuId(value); setRelationshipId(''); setOptions([]); setComparisonError('');
    if (!value) return;
    setLoading(true);
    try { setOptions(await onCompare(value)); }
    catch (requestError) { setComparisonError(requestError.message); }
    finally { setLoading(false); }
  }

  function submit(event) {
    event.preventDefault();
    onSubmit({
      supplierId: selected.supplier_id, poNumber: nowPoNumber(),
      orderDate: new Date().toISOString().slice(0, 10), expectedDeliveryDate: null,
      currency: selected.currency, paymentTermsDays: supplier?.payment_terms_days ?? null,
      notes: 'Created through the product-first purchasing workflow.',
      shippingCost: '0', otherCost: '0',
      items: [{
        skuId, supplierProductId: selected.id, quantityOrdered: quantity,
        unitCost: selected.current_unit_cost, discountAmount: '0', taxAmount: '0', notes: null,
      }],
    });
  }

  return <form className="purchasing-form product-first-po" onSubmit={submit}>
    <section className="form-section"><div className="section-number">1</div><div className="form-section-content"><div className="form-section-heading"><div><p className="eyebrow">Product first</p><h2>Choose the SKU to buy</h2></div></div><label>SKU<select required value={skuId} onChange={(event) => chooseSku(event.target.value)}><option value="">Choose SKU</option>{skus.map((item) => <option key={item.id} value={item.id}>{item.sku_code} · {item.product_name}</option>)}</select></label>{loading && <p className="form-note">Loading linked suppliers…</p>}{comparisonError && <p className="form-error">{comparisonError}</p>}</div></section>

    {skuId && !loading && <section className="form-section"><div className="section-number">2</div><div className="form-section-content"><div className="form-section-heading"><div><p className="eyebrow">Linked supplier options</p><h2>Select the supplier</h2></div><p>The recommendation is explainable and does not always choose the cheapest quote.</p></div>
      {options.length === 0 ? <div className="empty-state compact"><h3>No active linked supplier</h3><p>Link a supplier to this SKU before creating a purchase order.</p></div> : <div className="supplier-recommendation-list">{options.map((item) => <label key={item.id} className={relationshipId === item.id ? 'selected' : ''}><input type="radio" name="supplier-option" value={item.id} checked={relationshipId === item.id} onChange={() => setRelationshipId(item.id)} /><div><strong>{item.supplier_name}{item.is_recommended && <span className="status-pill approved">Recommended</span>}</strong><span>{Number(item.current_unit_cost).toFixed(2)} {item.currency} · MOQ {Number(item.moq)} · {item.lead_time_days} days</span><ul>{item.recommendation_reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>{item.missing_recommendation_data.length > 0 && <small>Missing: {item.missing_recommendation_data.join(', ')}</small>}<small>Price freshness: {item.quote_age_days === null ? 'not recorded' : item.quote_age_days + ' days old'}</small></div></label>)}</div>}
    </div></section>}

    {selected && <section className="form-section"><div className="section-number">3</div><div className="form-section-content"><div className="form-section-heading"><div><p className="eyebrow">Quantity and summary</p><h2>Review before creating</h2></div></div><label>Quantity<input required type="number" min="0.0001" step="0.0001" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>{Number(quantity) < Number(selected.moq) && <p className="form-error">Quantity is below the recorded MOQ of {Number(selected.moq)}.</p>}<div className="po-review-summary"><div><span>SKU</span><strong>{sku?.sku_code} · {sku?.product_name}</strong></div><div><span>Supplier</span><strong>{selected.supplier_name}</strong></div><div><span>Unit cost</span><strong>{Number(selected.current_unit_cost).toFixed(2)} {selected.currency}</strong></div><div><span>Estimated subtotal</span><strong>{subtotal.toFixed(2)} {selected.currency}</strong></div></div><p className="form-note">This button creates a draft purchase order only. Inventory changes later through the existing receiving workflow.</p></div></section>}

    {error && <div className="form-error" role="alert">{error.message}</div>}
    <div className="form-actions"><a className="text-button" href="#purchase-orders">Cancel</a><button className="primary-button" disabled={!selected || submitting || Number(quantity) < Number(selected?.moq || 0)}>{submitting ? 'Creating draft…' : 'Create draft purchase order'}</button></div>
  </form>;
}
