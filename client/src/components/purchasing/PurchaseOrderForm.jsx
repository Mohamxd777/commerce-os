import { useEffect, useMemo, useState } from 'react';
import BusinessTerm from '../BusinessTerm.jsx';
import { purchasingTerms } from './PurchasingTerms.js';

function today() {
  return new Date().toISOString().slice(0, 10);
}

function newItem(item = {}) {
  return {
    skuId: item.sku_id ?? item.skuId ?? '',
    supplierProductId: item.supplier_product_id ?? item.supplierProductId ?? '',
    quantityOrdered: item.quantity_ordered ?? item.quantityOrdered ?? '1',
    unitCost: item.unit_cost ?? item.unitCost ?? '0',
    discountAmount: item.discount_amount ?? item.discountAmount ?? '0',
    taxAmount: item.tax_amount ?? item.taxAmount ?? '0',
    notes: item.notes ?? '',
  };
}

function initialValues(initial) {
  return {
    supplierId: initial?.supplier_id ?? '',
    poNumber: initial?.po_number ?? 'PO-' + today().replaceAll('-', '') + '-001',
    orderDate: initial?.order_date?.slice?.(0, 10) ?? today(),
    expectedDeliveryDate: initial?.expected_delivery_date?.slice?.(0, 10) ?? '',
    currency: initial?.currency ?? 'EGP',
    paymentTermsDays: initial?.payment_terms_days ?? '',
    notes: initial?.notes ?? '',
    shippingCost: initial?.shipping_cost ?? '0',
    otherCost: initial?.other_cost ?? '0',
    items: initial?.items?.map(newItem) ?? [newItem()],
  };
}

export default function PurchaseOrderForm({
  initial,
  suppliers,
  skus,
  supplierProducts,
  onSupplierChange,
  onSubmit,
  submitting,
  error,
}) {
  const [form, setForm] = useState(() => initialValues(initial));

  useEffect(() => {
    if (form.supplierId) onSupplierChange?.(form.supplierId);
  }, [form.supplierId, onSupplierChange]);

  const supplier = suppliers.find((item) => item.id === form.supplierId);
  const estimate = useMemo(() => {
    const lines = form.items.reduce((sum, item) => {
      return sum + Number(item.quantityOrdered || 0) * Number(item.unitCost || 0)
        - Number(item.discountAmount || 0) + Number(item.taxAmount || 0);
    }, 0);
    return lines + Number(form.shippingCost || 0) + Number(form.otherCost || 0);
  }, [form]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateItem(index, field, value) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        if (field !== 'skuId') return { ...item, [field]: value };
        const relationship = supplierProducts.find((candidate) => candidate.sku_id === value);
        return {
          ...item,
          skuId: value,
          supplierProductId: relationship?.id ?? '',
          unitCost: relationship?.current_unit_cost ?? item.unitCost,
        };
      }),
    }));
  }

  function submit(event) {
    event.preventDefault();
    onSubmit({
      supplierId: form.supplierId,
      poNumber: form.poNumber,
      orderDate: form.orderDate,
      expectedDeliveryDate: form.expectedDeliveryDate || null,
      currency: form.currency.toUpperCase(),
      paymentTermsDays: form.paymentTermsDays === '' ? null : Number(form.paymentTermsDays),
      notes: form.notes || null,
      shippingCost: form.shippingCost || '0',
      otherCost: form.otherCost || '0',
      items: form.items.map((item) => ({
        skuId: item.skuId,
        supplierProductId: item.supplierProductId || null,
        quantityOrdered: item.quantityOrdered,
        unitCost: item.unitCost,
        discountAmount: item.discountAmount || '0',
        taxAmount: item.taxAmount || '0',
        notes: item.notes || null,
      })),
    });
  }

  return (
    <form className="purchasing-form" onSubmit={submit}>
      <section className="form-section">
        <div className="section-number">1</div>
        <div className="form-section-content">
          <div className="form-section-heading">
            <div><p className="eyebrow">Supplier</p><h2><BusinessTerm term="PO" explanation={purchasingTerms.PO} /> identity</h2></div>
          </div>
          <div className="form-grid three-columns">
            <label>Supplier<select required disabled={Boolean(initial)} value={form.supplierId} onChange={(event) => {
              const selected = suppliers.find((item) => item.id === event.target.value);
              setForm((current) => ({
                ...current,
                supplierId: event.target.value,
                currency: selected?.preferred_currency ?? current.currency,
                paymentTermsDays: selected?.payment_terms_days ?? current.paymentTermsDays,
              }));
            }}><option value="">Choose supplier</option>{suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label>PO number<input required disabled={Boolean(initial)} value={form.poNumber} onChange={(event) => update('poNumber', event.target.value.toUpperCase())} /></label>
            <label>Currency<input required minLength="3" maxLength="3" value={form.currency} onChange={(event) => update('currency', event.target.value.toUpperCase())} /></label>
            <label>Order date<input required type="date" value={form.orderDate} onChange={(event) => update('orderDate', event.target.value)} /></label>
            <label>Expected delivery<input type="date" min={form.orderDate} value={form.expectedDeliveryDate} onChange={(event) => update('expectedDeliveryDate', event.target.value)} /></label>
            <label><BusinessTerm term="Payment Terms" explanation={purchasingTerms['Payment Terms']} /><input aria-label="PO payment terms days" type="number" min="0" value={form.paymentTermsDays} onChange={(event) => update('paymentTermsDays', event.target.value)} /></label>
          </div>
          {supplier && <p className="form-note">Using {supplier.name} defaults. You remain in control of the final supplier and agreed line price.</p>}
        </div>
      </section>

      <section className="form-section">
        <div className="section-number">2</div>
        <div className="form-section-content">
          <div className="form-section-heading">
            <div><p className="eyebrow">Order lines</p><h2>Add SKUs and agreed costs</h2></div>
            <p>Supplier prices are suggestions. The saved PO line keeps the agreed historical cost.</p>
          </div>
          <div className="po-line-list">
            {form.items.map((item, index) => {
              const relationship = supplierProducts.find((candidate) => candidate.id === item.supplierProductId);
              return (
                <article className="po-line-card" key={index}>
                  <div className="po-line-heading"><strong>Line {index + 1}</strong>{form.items.length > 1 && <button type="button" className="text-button danger-text" onClick={() => update('items', form.items.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>}</div>
                  <div className="form-grid four-columns">
                    <label>SKU {index + 1}<select required value={item.skuId} onChange={(event) => updateItem(index, 'skuId', event.target.value)}><option value="">Choose SKU</option>{skus.map((sku) => <option key={sku.id} value={sku.id}>{sku.sku_code} · {sku.product_name}</option>)}</select></label>
                    <label>Quantity<input required type="number" min="0.0001" step="0.0001" value={item.quantityOrdered} onChange={(event) => updateItem(index, 'quantityOrdered', event.target.value)} /></label>
                    <label><BusinessTerm term="Unit Cost" explanation={purchasingTerms['Unit Cost']} /><input aria-label={'Unit cost ' + (index + 1)} required type="number" min="0" step="0.0001" value={item.unitCost} onChange={(event) => updateItem(index, 'unitCost', event.target.value)} /></label>
                    <label>Discount<input type="number" min="0" step="0.0001" value={item.discountAmount} onChange={(event) => updateItem(index, 'discountAmount', event.target.value)} /></label>
                    <label>Tax<input type="number" min="0" step="0.0001" value={item.taxAmount} onChange={(event) => updateItem(index, 'taxAmount', event.target.value)} /></label>
                    <label className="span-three">Line notes<input value={item.notes} onChange={(event) => updateItem(index, 'notes', event.target.value)} /></label>
                  </div>
                  {relationship ? <div className="supplier-hint"><span><BusinessTerm term="MOQ" explanation={purchasingTerms.MOQ} /> {relationship.moq}</span><span><BusinessTerm term="Lead Time" explanation={purchasingTerms['Lead Time']} /> {relationship.lead_time_days} days</span><span>{relationship.preferred ? 'Preferred supplier' : 'Available supplier'}</span></div> : <p className="form-note">No active supplier-specific relationship is attached to this SKU.</p>}
                </article>
              );
            })}
          </div>
          <button type="button" className="secondary-button" onClick={() => update('items', [...form.items, newItem()])}>Add another SKU</button>
        </div>
      </section>

      <section className="form-section">
        <div className="section-number">3</div>
        <div className="form-section-content">
          <div className="form-section-heading"><div><p className="eyebrow">Controlled costs</p><h2>Delivery and review</h2></div></div>
          <div className="form-grid three-columns">
            <label>Shipping cost<input type="number" min="0" step="0.0001" value={form.shippingCost} onChange={(event) => update('shippingCost', event.target.value)} /></label>
            <label>Other cost<input type="number" min="0" step="0.0001" value={form.otherCost} onChange={(event) => update('otherCost', event.target.value)} /></label>
            <div className="estimate-card"><span>UI estimate</span><strong>{estimate.toFixed(4)} {form.currency}</strong><small>The server recalculates every authoritative total.</small></div>
          </div>
          <label>PO notes<textarea value={form.notes} onChange={(event) => update('notes', event.target.value)} /></label>
        </div>
      </section>

      {error && <div className="form-error" role="alert">{error.message}</div>}
      <div className="form-actions">
        <a className="text-button" href="#purchase-orders">Cancel</a>
        <button className="primary-button" disabled={submitting}>{submitting ? 'Saving draft…' : initial ? 'Update draft PO' : 'Save as draft'}</button>
      </div>
    </form>
  );
}
