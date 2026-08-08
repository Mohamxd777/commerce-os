import { useCallback, useEffect, useState } from 'react';
import { purchasingApi } from '../../api/purchasingApi.js';
import BusinessTerm from '../../components/BusinessTerm.jsx';
import { ErrorState, LoadingState, PageHeader } from '../../components/catalog/CatalogStates.jsx';
import { purchasingTerms } from '../../components/purchasing/PurchasingTerms.js';

export default function PurchaseOrderDetailPage({ organizationId, purchaseOrderId }) {
  const [purchaseOrder, setPurchaseOrder] = useState(null);
  const [error, setError] = useState(null);
  const [working, setWorking] = useState(false);

  const load = useCallback(() => {
    purchasingApi.getPurchaseOrder(organizationId, purchaseOrderId)
      .then((result) => { setPurchaseOrder(result.data); setError(null); })
      .catch(setError);
  }, [organizationId, purchaseOrderId]);

  useEffect(load, [load]);

  async function action(operation) {
    setWorking(true);
    setError(null);
    try {
      await operation(organizationId, purchaseOrderId);
      load();
    } catch (actionError) {
      setError(actionError);
    } finally {
      setWorking(false);
    }
  }

  if (error && !purchaseOrder) return <ErrorState error={error} />;
  if (!purchaseOrder) return <LoadingState label="Loading purchase order…" />;

  const actions = [];
  if (purchaseOrder.status === 'draft') {
    actions.push(<a key="edit" className="secondary-button" href={'#purchase-orders/' + purchaseOrder.id + '/edit'}>Edit draft</a>);
    actions.push(<button key="approve" className="primary-button" disabled={working} onClick={() => action(purchasingApi.approvePurchaseOrder)}>Approve</button>);
  }
  if (purchaseOrder.status === 'approved') actions.push(<button key="order" className="primary-button" disabled={working} onClick={() => action(purchasingApi.markPurchaseOrderOrdered)}>Mark ordered</button>);
  if (['ordered', 'partially_received'].includes(purchaseOrder.status)) actions.push(<a key="receive" className="primary-button" href={'#purchase-orders/' + purchaseOrder.id + '/receive'}>Receive goods</a>);
  if (['draft', 'approved', 'ordered'].includes(purchaseOrder.status)) actions.push(<button key="cancel" className="text-button danger-text" disabled={working} onClick={() => action(purchasingApi.cancelPurchaseOrder)}>Cancel PO</button>);

  return (
    <>
      <PageHeader eyebrow="Purchase order" title={purchaseOrder.po_number} description={`${purchaseOrder.supplier_name} · ${purchaseOrder.order_date.slice(0, 10)}`} action={<div className="header-actions">{actions}</div>} />
      {error && <div className="form-error" role="alert">{error.message}</div>}
      <div className="detail-grid">
        <section className="detail-card span-two"><div className="detail-card-heading"><h2><BusinessTerm term="PO summary" explanation={purchasingTerms.PO} /></h2><span className={'status-pill ' + purchaseOrder.status}>{purchaseOrder.status.replace('_', ' ')}</span></div><dl className="definition-grid"><div><dt>Supplier</dt><dd><a className="table-link" href={'#suppliers/' + purchaseOrder.supplier_id}>{purchaseOrder.supplier_name}</a></dd></div><div><dt>Expected delivery</dt><dd>{purchaseOrder.expected_delivery_date?.slice(0, 10) || 'Not set'}</dd></div><div><dt>Currency</dt><dd>{purchaseOrder.currency}</dd></div><div><dt><BusinessTerm term="Payment Terms" explanation={purchasingTerms['Payment Terms']} /></dt><dd>{purchaseOrder.payment_terms_days === null ? 'Not set' : purchaseOrder.payment_terms_days + ' days'}</dd></div><div><dt>Approved by</dt><dd>{purchaseOrder.approved_by_name || 'Not approved'}</dd></div><div><dt>Created by</dt><dd>{purchaseOrder.created_by_name}</dd></div></dl><p className="detail-description">{purchaseOrder.notes || 'No notes.'}</p></section>
        <section className="detail-card span-two"><div className="detail-card-heading"><h2>Ordered and received quantities</h2><span>{purchaseOrder.items.length} lines</span></div><div className="catalog-table-wrap embedded-table"><table className="catalog-table"><thead><tr><th>SKU</th><th>Ordered</th><th>Accepted</th><th>Rejected</th><th>Remaining</th><th>Agreed unit cost</th><th>Line total</th></tr></thead><tbody>{purchaseOrder.items.map((item) => <tr key={item.id}><td>{item.sku_code}<small>{item.product_name} · {item.variant_name}</small></td><td>{item.quantity_ordered}</td><td>{item.quantity_received}</td><td>{item.quantity_rejected}</td><td><strong>{item.remaining_quantity}</strong></td><td>{item.unit_cost} {purchaseOrder.currency}</td><td>{item.line_total} {purchaseOrder.currency}</td></tr>)}</tbody></table></div></section>
        <section className="detail-card"><div className="detail-card-heading"><h2>Authoritative totals</h2></div><dl className="totals-list"><div><dt>Subtotal</dt><dd>{purchaseOrder.subtotal}</dd></div><div><dt>Discount</dt><dd>− {purchaseOrder.discount_total}</dd></div><div><dt>Tax</dt><dd>+ {purchaseOrder.tax_total}</dd></div><div><dt>Shipping</dt><dd>+ {purchaseOrder.shipping_cost}</dd></div><div><dt>Other cost</dt><dd>+ {purchaseOrder.other_cost}</dd></div><div className="grand-total"><dt>Grand total</dt><dd>{purchaseOrder.grand_total} {purchaseOrder.currency}</dd></div></dl></section>
        <section className="detail-card"><div className="detail-card-heading"><h2><BusinessTerm term="Goods Receipts" explanation={purchasingTerms['Goods Receipt']} /></h2><span>{purchaseOrder.receipts.length}</span></div>{purchaseOrder.receipts.length ? <div className="receipt-timeline">{purchaseOrder.receipts.map((receipt) => <a key={receipt.id} href={'#goods-receipts/' + receipt.id}><strong>{receipt.receipt_number}</strong><span>{receipt.received_date.slice(0, 10)} · {receipt.location_name}</span><small>Accepted {receipt.accepted_quantity} · Rejected {receipt.rejected_quantity}</small></a>)}</div> : <p>No goods have been received yet.</p>}<p className="form-note">Receipts do not directly change inventory in Task 3.</p></section>
      </div>
    </>
  );
}
