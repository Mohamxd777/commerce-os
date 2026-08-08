import { useEffect, useState } from 'react';
import { catalogApi } from '../../api/catalogApi.js';
import { inventoryApi } from '../../api/inventoryApi.js';
import { purchasingApi } from '../../api/purchasingApi.js';
import BusinessTerm from '../../components/BusinessTerm.jsx';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/catalog/CatalogStates.jsx';
import { inventoryTerms, quantity } from '../../components/inventory/InventoryTerms.js';

const movementTypes = ['PURCHASE_RECEIPT', 'TRANSFER_OUT', 'TRANSFER_IN', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'DAMAGE', 'QUARANTINE_IN', 'QUARANTINE_OUT', 'RELEASE_FROM_QUARANTINE', 'RESERVATION', 'RESERVATION_RELEASE'];

export default function InventoryMovementsPage({ organizationId }) {
  const emptyFilters = { skuId: '', locationId: '', movementType: '', stockBucket: '', referenceType: '', dateFrom: '', dateTo: '' };
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, total: 0, totalPages: 0 });
  const [options, setOptions] = useState({ skus: [], locations: [] });
  const [filters, setFilters] = useState(emptyFilters);
  const [applied, setApplied] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ loading: true, error: null });

  useEffect(() => {
    Promise.all([
      catalogApi.listSkus(organizationId, { limit: 100, isActive: true }),
      purchasingApi.listLocations(organizationId),
    ]).then(([skuResult, locationResult]) => setOptions({ skus: skuResult.data, locations: locationResult.data })).catch((error) => setState({ loading: false, error }));
  }, [organizationId]);

  useEffect(() => {
    inventoryApi.listMovements(organizationId, { ...applied, page, limit: 25 })
      .then((result) => { setRows(result.data); setMeta(result.meta); setState({ loading: false, error: null }); })
      .catch((error) => setState({ loading: false, error }));
  }, [organizationId, applied, page]);

  function field(name, children) {
    return <select aria-label={'Filter ' + name} value={filters[name]} onChange={(event) => setFilters({ ...filters, [name]: event.target.value })}><option value="">All {name.replace(/([A-Z])/g, ' $1').toLowerCase()}</option>{children}</select>;
  }

  return (
    <>
      <PageHeader eyebrow="Inventory" title={<BusinessTerm term="Movement ledger" explanation={inventoryTerms['Inventory Ledger']} />} description="Immutable stock history. Corrections are new movements, never edits to past evidence." />
      <form className="catalog-filters movement-filters" onSubmit={(event) => { event.preventDefault(); setPage(1); setApplied(filters); }}>
        {field('skuId', options.skus.map((sku) => <option key={sku.id} value={sku.id}>{sku.sku_code}</option>))}
        {field('locationId', options.locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>))}
        {field('movementType', movementTypes.map((type) => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>))}
        {field('stockBucket', ['available', 'reserved', 'quarantine', 'damaged'].map((bucket) => <option key={bucket} value={bucket}>{bucket}</option>))}
        {field('referenceType', ['goods_receipt', 'inventory_transfer', 'inventory_adjustment'].map((type) => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>))}
        <input aria-label="Date from" type="date" value={filters.dateFrom} onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })} />
        <input aria-label="Date to" type="date" value={filters.dateTo} onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })} />
        <button className="secondary-button">Apply</button>
      </form>
      {state.loading ? <LoadingState label="Loading movements…" /> : state.error ? <ErrorState error={state.error} /> : rows.length === 0 ? <EmptyState title="No matching movements" message="Change the filters or post the first inventory event." /> : <div className="catalog-table-wrap"><table className="catalog-table"><thead><tr><th>Timestamp</th><th>SKU / Product</th><th>Location</th><th>Movement</th><th>Quantity</th><th>Bucket</th><th>Reason / Reference</th><th>User</th></tr></thead><tbody>{rows.map((movement) => <tr key={movement.id}><td>{new Date(movement.occurred_at).toLocaleString()}</td><td><a className="table-link" href={'#inventory/skus/' + movement.sku_id}>{movement.sku_code}</a><small>{movement.product_name}</small></td><td>{movement.location_name}</td><td>{movement.movement_type.replaceAll('_', ' ')}</td><td className={Number(movement.quantity) < 0 ? 'negative-quantity' : 'positive-quantity'}>{Number(movement.quantity) > 0 ? '+' : ''}{quantity(movement.quantity)}</td><td>{movement.stock_bucket}</td><td>{movement.reason || '—'}<small>{movement.reference_type?.replaceAll('_', ' ') || 'No reference'}</small></td><td>{movement.created_by_name}</td></tr>)}</tbody></table><div className="pagination"><span>{meta.total} movements · Page {meta.page} of {meta.totalPages || 1}</span><div><button className="secondary-button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><button className="secondary-button" disabled={page >= meta.totalPages} onClick={() => setPage((value) => value + 1)}>Next</button></div></div></div>}
    </>
  );
}
