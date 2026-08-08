import { useEffect, useState } from 'react';
import { catalogApi } from '../../api/catalogApi.js';
import { inventoryApi } from '../../api/inventoryApi.js';
import { purchasingApi } from '../../api/purchasingApi.js';
import BusinessTerm from '../../components/BusinessTerm.jsx';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/catalog/CatalogStates.jsx';
import { inventoryTerms, quantity } from '../../components/inventory/InventoryTerms.js';

export default function InventoryStockPage({ organizationId }) {
  const [rows, setRows] = useState([]);
  const [locations, setLocations] = useState([]);
  const [skus, setSkus] = useState([]);
  const [meta, setMeta] = useState({ page: 1, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState({ search: '', skuId: '', locationId: '', lowStock: '' });
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ loading: true, error: null });

  useEffect(() => {
    Promise.all([
      purchasingApi.listLocations(organizationId),
      catalogApi.listSkus(organizationId, { limit: 100, isActive: true }),
    ]).then(([locationResult, skuResult]) => {
      setLocations(locationResult.data);
      setSkus(skuResult.data);
    }).catch((error) => setState({ loading: false, error }));
  }, [organizationId]);

  useEffect(() => {
    inventoryApi.listStock(organizationId, { ...applied, page, limit: 25 })
      .then((result) => { setRows(result.data); setMeta(result.meta); setState({ loading: false, error: null }); })
      .catch((error) => setState({ loading: false, error }));
  }, [organizationId, applied, page]);

  function submit(event) {
    event.preventDefault();
    setPage(1);
    setApplied(filters);
  }

  return (
    <>
      <PageHeader eyebrow="Inventory" title="Stock by location" description="Sellable, reserved, quarantined, and damaged stock derived from ledger movements." action={<a className="primary-button" href="#inventory/adjustments/new">Record adjustment</a>} />
      <form className="catalog-filters inventory-stock-filters" onSubmit={submit}>
        <input aria-label="Search stock" placeholder="SKU or product" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
        <select aria-label="Filter SKU" value={filters.skuId} onChange={(event) => setFilters({ ...filters, skuId: event.target.value })}><option value="">All SKUs</option>{skus.map((sku) => <option key={sku.id} value={sku.id}>{sku.sku_code}</option>)}</select>
        <select aria-label="Filter location" value={filters.locationId} onChange={(event) => setFilters({ ...filters, locationId: event.target.value })}><option value="">All locations</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select>
        <select aria-label="Filter low stock" value={filters.lowStock} onChange={(event) => setFilters({ ...filters, lowStock: event.target.value })}><option value="">All stock states</option><option value="true">Low stock only</option></select>
        <button className="secondary-button">Apply</button>
      </form>
      {state.loading ? <LoadingState label="Loading stock…" /> : state.error ? <ErrorState error={state.error} /> : rows.length === 0 ? <EmptyState title="No stock rows" message="Post an accepted goods receipt, record an adjustment, or configure a reorder rule." /> : <div className="catalog-table-wrap"><table className="catalog-table inventory-table"><thead><tr><th>SKU / Product</th><th>Location</th><th><BusinessTerm term="Available" explanation={inventoryTerms['Available Stock']} /></th><th><BusinessTerm term="Reserved" explanation={inventoryTerms['Reserved Stock']} /></th><th>Quarantine</th><th>Damaged</th><th>Total physical</th><th>Reorder point</th><th>Status</th></tr></thead><tbody>{rows.map((row) => <tr key={row.sku_id + row.location_id}><td><a className="table-link" href={'#inventory/skus/' + row.sku_id}>{row.sku_code}</a><small>{row.product_name} · {row.variant_name}</small></td><td>{row.location_name}<small>{row.location_code}</small></td><td>{quantity(row.available)}</td><td>{quantity(row.reserved)}</td><td>{quantity(row.quarantine)}</td><td>{quantity(row.damaged)}</td><td>{quantity(row.total_physical)}</td><td>{row.reorder_point == null ? '—' : quantity(row.reorder_point)}</td><td><span className={'status-pill ' + row.stock_status}>{row.stock_status.replaceAll('_', ' ')}</span></td></tr>)}</tbody></table><div className="pagination"><span>{meta.total} rows · Page {meta.page} of {meta.totalPages || 1}</span><div><button className="secondary-button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><button className="secondary-button" disabled={page >= meta.totalPages} onClick={() => setPage((value) => value + 1)}>Next</button></div></div></div>}
    </>
  );
}
