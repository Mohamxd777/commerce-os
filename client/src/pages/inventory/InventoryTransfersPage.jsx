import { useEffect, useState } from 'react';
import { inventoryApi } from '../../api/inventoryApi.js';
import { purchasingApi } from '../../api/purchasingApi.js';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/catalog/CatalogStates.jsx';
import { quantity } from '../../components/inventory/InventoryTerms.js';

export default function InventoryTransfersPage({ organizationId }) {
  const [rows, setRows] = useState([]);
  const [locations, setLocations] = useState([]);
  const [meta, setMeta] = useState({ page: 1, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState({ search: '', status: '', locationId: '' });
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ loading: true, error: null });

  useEffect(() => {
    purchasingApi.listLocations(organizationId).then((result) => setLocations(result.data)).catch((error) => setState({ loading: false, error }));
  }, [organizationId]);
  useEffect(() => {
    inventoryApi.listTransfers(organizationId, { ...applied, page, limit: 25 })
      .then((result) => { setRows(result.data); setMeta(result.meta); setState({ loading: false, error: null }); })
      .catch((error) => setState({ loading: false, error }));
  }, [organizationId, applied, page]);

  return (
    <>
      <PageHeader eyebrow="Inventory" title="Inventory transfers" description="Draft, ship, and receive stock between locations with separate ledger movements." action={<a className="primary-button" href="#inventory/transfers/new">Create transfer</a>} />
      <form className="catalog-filters transfer-filters" onSubmit={(event) => { event.preventDefault(); setPage(1); setApplied(filters); }}><input aria-label="Search transfers" placeholder="Transfer number" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} /><select aria-label="Filter transfer status" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">All statuses</option>{['draft', 'in_transit', 'received', 'cancelled'].map((status) => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}</select><select aria-label="Filter transfer location" value={filters.locationId} onChange={(event) => setFilters({ ...filters, locationId: event.target.value })}><option value="">All locations</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select><button className="secondary-button">Apply</button></form>
      {state.loading ? <LoadingState label="Loading transfers…" /> : state.error ? <ErrorState error={state.error} /> : rows.length === 0 ? <EmptyState title="No inventory transfers" message="Create a draft to plan stock movement between locations." /> : <div className="catalog-table-wrap"><table className="catalog-table"><thead><tr><th>Transfer</th><th>Route</th><th>Status</th><th>Items</th><th>Units</th><th>Shipped</th><th>Received</th></tr></thead><tbody>{rows.map((transfer) => <tr key={transfer.id}><td><a className="table-link" href={'#inventory/transfers/' + transfer.id}>{transfer.transfer_number}</a><small>{transfer.created_by_name}</small></td><td>{transfer.source_location_name}<small>→ {transfer.destination_location_name}</small></td><td><span className={'status-pill ' + transfer.status}>{transfer.status.replace('_', ' ')}</span></td><td>{transfer.item_count}</td><td>{quantity(transfer.total_units)}</td><td>{transfer.shipped_at ? new Date(transfer.shipped_at).toLocaleString() : '—'}</td><td>{transfer.received_at ? new Date(transfer.received_at).toLocaleString() : '—'}</td></tr>)}</tbody></table><div className="pagination"><span>{meta.total} transfers · Page {meta.page} of {meta.totalPages || 1}</span><div><button className="secondary-button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><button className="secondary-button" disabled={page >= meta.totalPages} onClick={() => setPage((value) => value + 1)}>Next</button></div></div></div>}
    </>
  );
}
