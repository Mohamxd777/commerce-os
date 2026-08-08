import { useCallback, useEffect, useState } from 'react';
import { inventoryApi } from '../../api/inventoryApi.js';
import { ErrorState, LoadingState, PageHeader } from '../../components/catalog/CatalogStates.jsx';
import { quantity } from '../../components/inventory/InventoryTerms.js';

export default function InventoryTransferDetailPage({ organizationId, transferId }) {
  const [transfer, setTransfer] = useState(null);
  const [error, setError] = useState(null);
  const [acting, setActing] = useState(false);
  const load = useCallback(() => inventoryApi.getTransfer(organizationId, transferId).then((result) => setTransfer(result.data)).catch(setError), [organizationId, transferId]);
  useEffect(() => { load(); }, [load]);

  async function action(name, explanation) {
    if (!window.confirm(explanation)) return;
    setActing(true);
    setError(null);
    try {
      const result = await inventoryApi[name](organizationId, transferId);
      setTransfer(result.data);
    } catch (requestError) {
      setError(requestError);
    } finally {
      setActing(false);
    }
  }

  if (error && !transfer) return <ErrorState error={error} />;
  if (!transfer) return <LoadingState label="Loading transfer…" />;
  const actions = <div className="header-actions">{transfer.status === 'draft' && <><button className="secondary-button" disabled={acting} onClick={() => action('cancelTransfer', 'Cancel this draft? It will retain its audit history and move no stock.')}>Cancel</button><button className="primary-button" disabled={acting} onClick={() => action('shipTransfer', 'Ship this transfer? Available stock will be removed from the source immediately and become in transit. This cannot be casually reversed.')}>Ship transfer</button></>}{transfer.status === 'in_transit' && <button className="primary-button" disabled={acting} onClick={() => action('receiveTransfer', 'Receive this transfer? The item quantities will enter available stock at the destination. Repeated requests cannot post twice.')}>Receive transfer</button>}</div>;
  return (
    <>
      <PageHeader eyebrow="Inventory transfer" title={transfer.transfer_number} description={`${transfer.source_location_name} → ${transfer.destination_location_name}`} action={actions} />
      {error && <div className="form-error" role="alert">{error.message}</div>}
      <div className="detail-grid">
        <section className="detail-card"><div className="detail-card-heading"><h2>Workflow state</h2><span className={'status-pill ' + transfer.status}>{transfer.status.replace('_', ' ')}</span></div><dl className="definition-grid transfer-definition"><div><dt>Created by</dt><dd>{transfer.created_by_name}</dd></div><div><dt>Created</dt><dd>{new Date(transfer.created_at).toLocaleString()}</dd></div><div><dt>Shipped</dt><dd>{transfer.shipped_at ? new Date(transfer.shipped_at).toLocaleString() : 'Not shipped'}</dd></div><div><dt>Received</dt><dd>{transfer.received_at ? new Date(transfer.received_at).toLocaleString() : 'Not received'}</dd></div></dl><p className="detail-description">{transfer.notes || 'No transfer notes.'}</p></section>
        <section className="detail-card"><div className="detail-card-heading"><h2>Ledger effect</h2></div><div className="immutable-note"><strong>{transfer.status === 'draft' ? 'No movements yet' : transfer.status === 'in_transit' ? 'Source posted' : transfer.status === 'received' ? 'Source and destination posted' : 'Cancelled without stock movement'}</strong><span>{transfer.status === 'in_transit' ? 'TRANSFER_OUT is posted; quantities are derived as in transit until receipt.' : transfer.status === 'received' ? 'TRANSFER_OUT and TRANSFER_IN provide the complete audit trail.' : 'Draft planning does not alter balances.'}</span></div></section>
        <section className="detail-card span-two"><div className="detail-card-heading"><h2>Transfer items</h2><span>{transfer.items.length}</span></div><div className="catalog-table-wrap embedded-table"><table className="catalog-table"><thead><tr><th>SKU</th><th>Product</th><th>Quantity</th><th>Source available now</th></tr></thead><tbody>{transfer.items.map((item) => <tr key={item.id}><td><a className="table-link" href={'#inventory/skus/' + item.sku_id}>{item.sku_code}</a></td><td>{item.product_name}<small>{item.variant_name}</small></td><td>{quantity(item.quantity)}</td><td>{quantity(item.source_available)}</td></tr>)}</tbody></table></div></section>
      </div>
    </>
  );
}
