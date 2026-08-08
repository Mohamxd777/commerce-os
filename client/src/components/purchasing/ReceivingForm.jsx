import { useState } from 'react';
import BusinessTerm from '../BusinessTerm.jsx';
import { purchasingTerms } from './PurchasingTerms.js';

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function ReceivingForm({ purchaseOrder, locations, onSubmit, submitting, error }) {
  const [receivedDate, setReceivedDate] = useState(today());
  const [locationId, setLocationId] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const [quantities, setQuantities] = useState(() => Object.fromEntries(
    purchaseOrder.items.map((item) => [item.id, {
      quantityReceived: '0',
      quantityRejected: '0',
      conditionNotes: '',
    }]),
  ));
  const [localError, setLocalError] = useState(null);

  function update(itemId, field, value) {
    setQuantities((current) => ({
      ...current,
      [itemId]: { ...current[itemId], [field]: value },
    }));
  }

  function submit(event) {
    event.preventDefault();
    setLocalError(null);
    const items = purchaseOrder.items.flatMap((item) => {
      const entered = quantities[item.id];
      if (Number(entered.quantityReceived) > Number(item.remaining_quantity)) {
        setLocalError('Accepted quantity cannot exceed the remaining quantity.');
        return [];
      }
      if (Number(entered.quantityReceived) <= 0 && Number(entered.quantityRejected) <= 0) return [];
      return [{
        purchaseOrderItemId: item.id,
        quantityReceived: entered.quantityReceived || '0',
        quantityRejected: entered.quantityRejected || '0',
        conditionNotes: entered.conditionNotes || null,
      }];
    });
    if (items.length === 0) {
      setLocalError('Enter at least one accepted or rejected quantity.');
      return;
    }
    onSubmit({
      receiptNumber: receiptNumber || undefined,
      receivedDate,
      locationId,
      notes: notes || null,
      items,
    });
  }

  return (
    <form className="purchasing-form" onSubmit={submit}>
      <section className="form-section">
        <div className="section-number">1</div>
        <div className="form-section-content">
          <div className="form-section-heading"><div><p className="eyebrow">Open PO</p><h2>{purchaseOrder.po_number}</h2></div><span className={'status-pill ' + purchaseOrder.status}>{purchaseOrder.status.replace('_', ' ')}</span></div>
          <p>Review ordered and previously accepted quantities before entering this delivery.</p>
        </div>
      </section>
      <section className="form-section">
        <div className="section-number">2</div>
        <div className="form-section-content">
          <div className="form-section-heading"><div><p className="eyebrow">Delivery</p><h2><BusinessTerm term="Goods Receipt" explanation={purchasingTerms['Goods Receipt']} /></h2></div></div>
          <div className="form-grid three-columns">
            <label>Receiving location<select required value={locationId} onChange={(event) => setLocationId(event.target.value)}><option value="">Choose location</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name} · {location.code}</option>)}</select></label>
            <label>Received date<input required type="date" min={purchaseOrder.order_date.slice(0, 10)} value={receivedDate} onChange={(event) => setReceivedDate(event.target.value)} /></label>
            <label>Receipt number<input value={receiptNumber} onChange={(event) => setReceiptNumber(event.target.value.toUpperCase())} placeholder="Generated if blank" /></label>
          </div>
        </div>
      </section>
      <section className="form-section">
        <div className="section-number">3</div>
        <div className="form-section-content">
          <div className="form-section-heading"><div><p className="eyebrow">Quantities</p><h2>Accepted and rejected units</h2></div><p>Accepted quantities fulfill the PO. Rejected quantities remain separate and never increase inventory.</p></div>
          <div className="receiving-lines">
            {purchaseOrder.items.map((item) => (
              <article className="receiving-line" key={item.id}>
                <div><strong>{item.sku_code}</strong><span>{item.product_name} · {item.variant_name}</span></div>
                <dl><div><dt>Ordered</dt><dd>{item.quantity_ordered}</dd></div><div><dt>Already received</dt><dd>{item.quantity_received}</dd></div><div><dt>Remaining</dt><dd>{item.remaining_quantity}</dd></div></dl>
                <div className="form-grid three-columns">
                  <label>New accepted quantity for {item.sku_code}<input aria-label={'Accepted quantity ' + item.sku_code} type="number" min="0" max={item.remaining_quantity} step="0.0001" value={quantities[item.id].quantityReceived} onChange={(event) => update(item.id, 'quantityReceived', event.target.value)} /></label>
                  <label>Rejected or damaged<input aria-label={'Rejected quantity ' + item.sku_code} type="number" min="0" step="0.0001" value={quantities[item.id].quantityRejected} onChange={(event) => update(item.id, 'quantityRejected', event.target.value)} /></label>
                  <label>Condition notes<input value={quantities[item.id].conditionNotes} onChange={(event) => update(item.id, 'conditionNotes', event.target.value)} /></label>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="form-section">
        <div className="section-number">4</div>
        <div className="form-section-content">
          <div className="form-section-heading"><div><p className="eyebrow">Review</p><h2>Confirm receipt evidence</h2></div></div>
          <label>Receipt notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
          <label className="checkbox-label"><input required type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} />I reviewed the accepted, rejected, location, and remaining quantities.</label>
          <p className="form-note">This records receipt history only. Task 4 will create inventory ledger movements from accepted receipt items.</p>
        </div>
      </section>
      {(localError || error) && <div className="form-error" role="alert">{localError || error.message}</div>}
      <div className="form-actions"><a className="text-button" href={'#purchase-orders/' + purchaseOrder.id}>Cancel</a><button className="primary-button" disabled={submitting || !reviewed}>{submitting ? 'Confirming…' : 'Confirm goods receipt'}</button></div>
    </form>
  );
}
