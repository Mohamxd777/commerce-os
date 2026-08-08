import { useEffect, useState } from 'react';
import { inventoryApi } from '../../api/inventoryApi.js';
import BusinessTerm from '../../components/BusinessTerm.jsx';
import { ErrorState, LoadingState, PageHeader } from '../../components/catalog/CatalogStates.jsx';
import { inventoryTerms, quantity } from '../../components/inventory/InventoryTerms.js';

export default function InventoryOverviewPage({ organizationId }) {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [reconciliation, setReconciliation] = useState(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    inventoryApi.getSummary(organizationId).then((result) => setSummary(result.data)).catch(setError);
  }, [organizationId]);

  async function reconcile() {
    setChecking(true);
    setError(null);
    try {
      const result = await inventoryApi.reconcile(organizationId);
      setReconciliation(result.data);
    } catch (requestError) {
      setError(requestError);
    } finally {
      setChecking(false);
    }
  }

  if (error && !summary) return <ErrorState error={error} />;
  if (!summary) return <LoadingState label="Loading inventory summary…" />;

  const cards = [
    ['SKUs with stock', summary.active_skus_with_stock, 'Distinct active inventory identities'],
    ['Available units', quantity(summary.available_units), 'Sellable or usable now'],
    ['Low-stock rows', summary.low_stock_skus, 'At or below a configured reorder point'],
    ['Out of stock', summary.out_of_stock_skus, 'No available units at a location'],
    ['Quarantined', quantity(summary.quarantined_units), 'Temporarily unavailable for inspection'],
    ['Damaged', quantity(summary.damaged_units), 'Physical but non-sellable'],
    ['Transfers in transit', summary.transfers_in_transit, 'Shipped but not received'],
  ];

  return (
    <>
      <PageHeader
        eyebrow="Inventory"
        title="Inventory control center"
        description="Current stock is a projection of an immutable movement ledger—not a quantity field on the SKU."
        action={<div className="header-actions"><a className="secondary-button" href="#inventory/adjustments/new">Record adjustment</a><a className="primary-button" href="#inventory/transfers/new">Create transfer</a></div>}
      />
      <div className="summary-grid inventory-summary-grid">
        {cards.map(([label, value, description]) => <article className="summary-card" key={label}><span>{label === 'Available units' ? <BusinessTerm term={label} explanation={inventoryTerms['Available Stock']} /> : label}</span><strong>{value}</strong><small>{description}</small></article>)}
      </div>
      <div className="detail-grid inventory-overview-grid">
        <section className="detail-card span-two">
          <div className="detail-card-heading"><h2><BusinessTerm term="Recent inventory ledger" explanation={inventoryTerms['Inventory Ledger']} /></h2><a className="text-button" href="#inventory/movements">Full history</a></div>
          {summary.recentMovements.length === 0 ? <p className="form-note">No inventory movements have been posted.</p> : <div className="catalog-table-wrap embedded-table"><table className="catalog-table"><thead><tr><th>When</th><th>SKU</th><th>Location</th><th>Movement</th><th>Bucket</th><th>Quantity</th></tr></thead><tbody>{summary.recentMovements.map((movement) => <tr key={movement.id}><td>{new Date(movement.occurred_at).toLocaleString()}</td><td><a className="table-link" href={'#inventory/skus/' + movement.sku_id}>{movement.sku_code}</a><small>{movement.product_name}</small></td><td>{movement.location_name}</td><td>{movement.movement_type.replaceAll('_', ' ')}</td><td>{movement.stock_bucket}</td><td className={Number(movement.quantity) < 0 ? 'negative-quantity' : 'positive-quantity'}>{Number(movement.quantity) > 0 ? '+' : ''}{quantity(movement.quantity)}</td></tr>)}</tbody></table></div>}
        </section>
        <section className="detail-card span-two reconciliation-card">
          <div><p className="eyebrow">Projection health</p><h2>Ledger / balance reconciliation</h2><p>The check reports differences and never silently rewrites a balance.</p></div>
          <div className="header-actions">{reconciliation && <span className={'status-pill ' + (reconciliation.reconciled ? 'active' : 'cancelled')}>{reconciliation.reconciled ? 'Reconciled' : `${reconciliation.mismatchCount} mismatches`}</span>}<button className="secondary-button" disabled={checking} onClick={reconcile}>{checking ? 'Checking…' : 'Run reconciliation'}</button></div>
          {error && <div className="form-error" role="alert">{error.message}</div>}
        </section>
      </div>
    </>
  );
}
