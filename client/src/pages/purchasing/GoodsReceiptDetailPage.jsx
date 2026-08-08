import { useEffect, useState } from 'react';
import { purchasingApi } from '../../api/purchasingApi.js';
import BusinessTerm from '../../components/BusinessTerm.jsx';
import { ErrorState, LoadingState, PageHeader } from '../../components/catalog/CatalogStates.jsx';
import { purchasingTerms } from '../../components/purchasing/PurchasingTerms.js';

export default function GoodsReceiptDetailPage({ organizationId, receiptId }) {
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    purchasingApi.getGoodsReceipt(organizationId, receiptId).then((result) => setReceipt(result.data)).catch(setError);
  }, [organizationId, receiptId]);
  if (error) return <ErrorState error={error} />;
  if (!receipt) return <LoadingState label="Loading goods receipt…" />;
  return (
    <>
      <PageHeader eyebrow="Goods receipt" title={receipt.receipt_number} description={`${receipt.supplier_name} · ${receipt.received_date.slice(0, 10)}`} action={<a className="secondary-button" href={'#purchase-orders/' + receipt.purchase_order_id}>Open PO</a>} />
      <div className="detail-grid"><section className="detail-card span-two"><div className="detail-card-heading"><h2><BusinessTerm term="Receipt evidence" explanation={purchasingTerms['Goods Receipt']} /></h2><span>{receipt.location_name}</span></div><dl className="definition-grid"><div><dt>Purchase order</dt><dd>{receipt.po_number}</dd></div><div><dt>Received by</dt><dd>{receipt.received_by_name}</dd></div><div><dt>PO status</dt><dd>{receipt.purchase_order_status.replace('_', ' ')}</dd></div><div><dt>Created</dt><dd>{new Date(receipt.created_at).toLocaleString()}</dd></div></dl><p>{receipt.notes || 'No receipt notes.'}</p></section><section className="detail-card span-two"><div className="detail-card-heading"><h2>Receipt items</h2><span>{receipt.items.length}</span></div><div className="catalog-table-wrap embedded-table"><table className="catalog-table"><thead><tr><th>SKU</th><th>Ordered</th><th>Accepted here</th><th>Rejected here</th><th>Condition</th></tr></thead><tbody>{receipt.items.map((item) => <tr key={item.id}><td>{item.sku_code}<small>{item.product_name} · {item.variant_name}</small></td><td>{item.quantity_ordered}</td><td>{item.quantity_received}</td><td>{item.quantity_rejected}</td><td>{item.condition_notes || '—'}</td></tr>)}</tbody></table></div><p className="form-note">No inventory transaction was created. Task 4 can reference each receipt-item ID exactly once.</p></section></div>
    </>
  );
}
