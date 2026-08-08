import { useEffect, useState } from 'react';
import { inventoryApi } from '../../api/inventoryApi.js';
import { purchasingApi } from '../../api/purchasingApi.js';
import BusinessTerm from '../../components/BusinessTerm.jsx';
import { ErrorState, LoadingState, PageHeader } from '../../components/catalog/CatalogStates.jsx';
import { purchasingTerms } from '../../components/purchasing/PurchasingTerms.js';

export default function GoodsReceiptDetailPage({ organizationId, receiptId }) {
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState(null);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    purchasingApi.getGoodsReceipt(organizationId, receiptId)
      .then((result) => setReceipt(result.data))
      .catch(setError);
  }, [organizationId, receiptId]);

  async function postInventory() {
    if (!window.confirm('Post accepted quantities to available inventory? Rejected quantities will not enter stock, and this receipt cannot post twice.')) return;
    setPosting(true);
    setError(null);
    try {
      const result = await inventoryApi.postGoodsReceipt(organizationId, receiptId);
      setReceipt((current) => ({
        ...current,
        inventory_posted_at: result.data.receipt.inventory_posted_at,
        inventory_posted_by: result.data.receipt.inventory_posted_by,
      }));
    } catch (requestError) {
      setError(requestError);
    } finally {
      setPosting(false);
    }
  }

  if (error && !receipt) return <ErrorState error={error} />;
  if (!receipt) return <LoadingState label="Loading goods receipt…" />;

  const action = (
    <div className="header-actions">
      <a className="secondary-button" href={'#purchase-orders/' + receipt.purchase_order_id}>Open PO</a>
      {receipt.inventory_posted_at
        ? <span className="status-pill active">Inventory posted</span>
        : <button className="primary-button" disabled={posting} onClick={postInventory}>{posting ? 'Posting…' : 'Post inventory'}</button>}
    </div>
  );

  return (
    <>
      <PageHeader eyebrow="Goods receipt" title={receipt.receipt_number} description={`${receipt.supplier_name} · ${receipt.received_date.slice(0, 10)}`} action={action} />
      {error && <div className="form-error" role="alert">{error.message}</div>}
      <div className="detail-grid">
        <section className="detail-card span-two">
          <div className="detail-card-heading"><h2><BusinessTerm term="Receipt evidence" explanation={purchasingTerms['Goods Receipt']} /></h2><span>{receipt.location_name}</span></div>
          <dl className="definition-grid">
            <div><dt>Purchase order</dt><dd>{receipt.po_number}</dd></div>
            <div><dt>Received by</dt><dd>{receipt.received_by_name}</dd></div>
            <div><dt>PO status</dt><dd>{receipt.purchase_order_status.replace('_', ' ')}</dd></div>
            <div><dt>Inventory</dt><dd>{receipt.inventory_posted_at ? 'Posted ' + new Date(receipt.inventory_posted_at).toLocaleString() : 'Awaiting explicit post'}</dd></div>
          </dl>
          <p>{receipt.notes || 'No receipt notes.'}</p>
        </section>
        <section className="detail-card span-two">
          <div className="detail-card-heading"><h2>Receipt items</h2><span>{receipt.items.length}</span></div>
          <div className="catalog-table-wrap embedded-table"><table className="catalog-table"><thead><tr><th>SKU</th><th>Ordered</th><th>Accepted here</th><th>Rejected here</th><th>Condition</th></tr></thead><tbody>{receipt.items.map((item) => <tr key={item.id}><td>{item.sku_code}<small>{item.product_name} · {item.variant_name}</small></td><td>{item.quantity_ordered}</td><td>{item.quantity_received}</td><td>{item.quantity_rejected}</td><td>{item.condition_notes || '—'}</td></tr>)}</tbody></table></div>
          <p className="form-note">Only accepted quantities post as PURCHASE_RECEIPT into available stock. Database idempotency prevents duplicate posting.</p>
        </section>
      </div>
    </>
  );
}
