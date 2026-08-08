import { useCallback, useEffect, useState } from 'react';
import { catalogApi } from '../../api/catalogApi.js';
import { purchasingApi } from '../../api/purchasingApi.js';
import BusinessTerm from '../../components/BusinessTerm.jsx';
import { ErrorState, LoadingState, PageHeader } from '../../components/catalog/CatalogStates.jsx';
import { purchasingTerms } from '../../components/purchasing/PurchasingTerms.js';

export default function SupplierDetailPage({ organizationId, supplierId }) {
  const [supplier, setSupplier] = useState(null);
  const [skus, setSkus] = useState([]);
  const [link, setLink] = useState({ skuId: '', supplierSkuCode: '', currentUnitCost: '0', currency: 'EGP', moq: '1', leadTimeDays: '0', preferred: false });
  const [priceEdit, setPriceEdit] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    Promise.all([
      purchasingApi.getSupplier(organizationId, supplierId),
      catalogApi.listSkus(organizationId, { limit: 100, isActive: true }),
    ]).then(([supplierResult, skuResult]) => {
      setSupplier(supplierResult.data);
      setSkus(skuResult.data);
      setLink((current) => ({ ...current, currency: supplierResult.data.preferred_currency }));
      setError(null);
    }).catch(setError);
  }, [organizationId, supplierId]);

  useEffect(load, [load]);

  async function addLink(event) {
    event.preventDefault();
    try {
      await purchasingApi.createSupplierProduct(organizationId, {
        supplierId,
        skuId: link.skuId,
        supplierSkuCode: link.supplierSkuCode || null,
        currentUnitCost: link.currentUnitCost,
        currency: link.currency,
        moq: link.moq,
        leadTimeDays: Number(link.leadTimeDays),
        preferred: link.preferred,
        isActive: true,
      });
      setLink((current) => ({ ...current, skuId: '', supplierSkuCode: '', currentUnitCost: '0', moq: '1', leadTimeDays: '0', preferred: false }));
      load();
    } catch (submitError) {
      setError(submitError);
    }
  }

  async function savePrice(event) {
    event.preventDefault();
    try {
      await purchasingApi.updateSupplierPrice(organizationId, priceEdit.id, {
        unitCost: priceEdit.unitCost,
        currency: priceEdit.currency,
        source: 'Supplier detail update',
      });
      setPriceEdit(null);
      load();
    } catch (submitError) {
      setError(submitError);
    }
  }

  async function toggleSupplier() {
    await purchasingApi.patchSupplier(organizationId, supplierId, { isActive: !supplier.is_active });
    load();
  }

  if (error && !supplier) return <ErrorState error={error} />;
  if (!supplier) return <LoadingState label="Loading supplier detail…" />;

  return (
    <>
      <PageHeader eyebrow="Supplier detail" title={supplier.name} description={supplier.legal_name || 'No legal name'} action={<div className="header-actions"><a className="secondary-button" href={'#suppliers/' + supplier.id + '/edit'}>Edit</a><button className="secondary-button" onClick={toggleSupplier}>{supplier.is_active ? 'Archive' : 'Reactivate'}</button></div>} />
      {error && <div className="form-error" role="alert">{error.message}</div>}
      <div className="detail-grid">
        <section className="detail-card span-two"><div className="detail-card-heading"><h2>Supplier information</h2><span className={'status-pill ' + (supplier.is_active ? 'active' : 'archived')}>{supplier.is_active ? 'active' : 'archived'}</span></div><dl className="definition-grid"><div><dt>Contact</dt><dd>{supplier.contact_person || 'Not set'}</dd></div><div><dt>Email</dt><dd>{supplier.email || 'Not set'}</dd></div><div><dt>Phone</dt><dd>{supplier.phone || 'Not set'}</dd></div><div><dt><BusinessTerm term="Payment Terms" explanation={purchasingTerms['Payment Terms']} /></dt><dd>{supplier.payment_terms_days === null ? 'Not set' : supplier.payment_terms_days + ' days'}</dd></div><div><dt>Preferred currency</dt><dd>{supplier.preferred_currency}</dd></div><div><dt>Tax number</dt><dd>{supplier.tax_number || 'Not set'}</dd></div></dl><p className="detail-description">{supplier.address || 'No address recorded.'}</p></section>

        <section className="detail-card span-two"><div className="detail-card-heading"><h2>Link a SKU</h2><span>{supplier.linkedSkus.length} relationships</span></div><form className="supplier-link-form" onSubmit={addLink}><div className="form-grid four-columns"><label>SKU<select required value={link.skuId} onChange={(event) => setLink((current) => ({ ...current, skuId: event.target.value }))}><option value="">Choose SKU</option>{skus.map((sku) => <option key={sku.id} value={sku.id}>{sku.sku_code} · {sku.product_name}</option>)}</select></label><label>Supplier SKU code<input value={link.supplierSkuCode} onChange={(event) => setLink((current) => ({ ...current, supplierSkuCode: event.target.value }))} /></label><label><BusinessTerm term="Unit Cost" explanation={purchasingTerms['Unit Cost']} /><input aria-label="Supplier unit cost" required type="number" min="0" step="0.0001" value={link.currentUnitCost} onChange={(event) => setLink((current) => ({ ...current, currentUnitCost: event.target.value }))} /></label><label>Currency<input required minLength="3" maxLength="3" value={link.currency} onChange={(event) => setLink((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} /></label><label><BusinessTerm term="MOQ" explanation={purchasingTerms.MOQ} /><input aria-label="Supplier MOQ" required type="number" min="0.0001" step="0.0001" value={link.moq} onChange={(event) => setLink((current) => ({ ...current, moq: event.target.value }))} /></label><label><BusinessTerm term="Lead Time" explanation={purchasingTerms['Lead Time']} /><input aria-label="Supplier lead time" required type="number" min="0" value={link.leadTimeDays} onChange={(event) => setLink((current) => ({ ...current, leadTimeDays: event.target.value }))} /></label><label className="checkbox-label"><input type="checkbox" checked={link.preferred} onChange={(event) => setLink((current) => ({ ...current, preferred: event.target.checked }))} />Preferred for this SKU</label><button className="primary-button">Link SKU</button></div></form>
          <div className="catalog-table-wrap embedded-table"><table className="catalog-table"><thead><tr><th>SKU</th><th>Current cost</th><th>MOQ</th><th>Lead time</th><th>Preferred</th><th>Price</th></tr></thead><tbody>{supplier.linkedSkus.map((item) => <tr key={item.id}><td><a className="table-link" href={'#skus/' + item.sku_id + '/suppliers'}>{item.sku_code}</a><small>{item.product_name} · {item.variant_name}</small></td><td>{item.current_unit_cost} {item.currency}</td><td>{item.moq}</td><td>{item.lead_time_days} days</td><td>{item.preferred ? 'Yes' : 'No'}</td><td>{priceEdit?.id === item.id ? <form className="price-inline-form" onSubmit={savePrice}><input aria-label="New unit cost" type="number" min="0" step="0.0001" value={priceEdit.unitCost} onChange={(event) => setPriceEdit((current) => ({ ...current, unitCost: event.target.value }))} /><button className="text-button">Save</button></form> : <button className="text-button" onClick={() => setPriceEdit({ id: item.id, unitCost: item.current_unit_cost, currency: item.currency })}>Update price</button>}</td></tr>)}</tbody></table></div>
        </section>

        <section className="detail-card span-two"><div className="detail-card-heading"><h2>Purchase-order history</h2><span>{supplier.purchaseOrders.length} recent</span></div>{supplier.purchaseOrders.length ? <div className="catalog-table-wrap embedded-table"><table className="catalog-table"><thead><tr><th>PO</th><th>Date</th><th>Status</th><th>Total</th></tr></thead><tbody>{supplier.purchaseOrders.map((po) => <tr key={po.id}><td><a className="table-link" href={'#purchase-orders/' + po.id}>{po.po_number}</a></td><td>{po.order_date.slice(0, 10)}</td><td><span className={'status-pill ' + po.status}>{po.status.replace('_', ' ')}</span></td><td>{po.grand_total} {po.currency}</td></tr>)}</tbody></table></div> : <p>No purchase orders yet.</p>}</section>
        <section className="detail-card span-two"><div className="detail-card-heading"><h2>Price history summary</h2><span>{supplier.priceHistory.length} recent entries</span></div><div className="history-list">{supplier.priceHistory.map((history) => <article key={history.id}><div><strong>{history.sku_code}</strong><span>{history.product_name}</span></div><div><strong>{history.unit_cost} {history.currency}</strong><span>{new Date(history.effective_from).toLocaleString()} · {history.source || 'No source'}</span></div></article>)}</div></section>
      </div>
    </>
  );
}
