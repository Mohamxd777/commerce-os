import { useEffect, useState } from 'react';
import { purchasingApi } from '../../api/purchasingApi.js';
import BusinessTerm from '../../components/BusinessTerm.jsx';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/catalog/CatalogStates.jsx';
import { purchasingTerms } from '../../components/purchasing/PurchasingTerms.js';

export default function PurchaseOrdersPage({ organizationId }) {
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [meta, setMeta] = useState({ page: 1, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState({ search: '', supplierId: '', status: '', dateFrom: '', dateTo: '', expectedFrom: '', expectedTo: '' });
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ loading: true, error: null });

  useEffect(() => {
    purchasingApi.listSuppliers(organizationId, { limit: 100, isActive: true })
      .then((result) => setSuppliers(result.data))
      .catch(() => {});
  }, [organizationId]);

  useEffect(() => {
    purchasingApi.listPurchaseOrders(organizationId, { ...applied, page, limit: 25 })
      .then((result) => {
        setPurchaseOrders(result.data);
        setMeta(result.meta);
        setState({ loading: false, error: null });
      })
      .catch((error) => setState({ loading: false, error }));
  }, [organizationId, applied, page]);

  return (
    <>
      <PageHeader eyebrow="Purchasing" title={<BusinessTerm term="Purchase Orders" explanation={purchasingTerms.PO} />} description="Search and filter purchase commitments with server-side pagination and controlled statuses." action={<a className="primary-button" href="#purchase-orders/new">Create PO</a>} />
      <form className="catalog-filters po-filters" onSubmit={(event) => { event.preventDefault(); setPage(1); setApplied(filters); }}>
        <input aria-label="Search purchase orders" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="PO number or supplier" />
        <select aria-label="Filter POs by supplier" value={filters.supplierId} onChange={(event) => setFilters((current) => ({ ...current, supplierId: event.target.value }))}><option value="">All suppliers</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select>
        <select aria-label="Filter POs by status" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="">All statuses</option>{['draft', 'approved', 'ordered', 'partially_received', 'received', 'cancelled'].map((status) => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}</select>
        <label>Order from<input type="date" value={filters.dateFrom} onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))} /></label>
        <label>Order to<input type="date" value={filters.dateTo} onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))} /></label>
        <label>Expected from<input type="date" value={filters.expectedFrom} onChange={(event) => setFilters((current) => ({ ...current, expectedFrom: event.target.value }))} /></label>
        <label>Expected to<input type="date" value={filters.expectedTo} onChange={(event) => setFilters((current) => ({ ...current, expectedTo: event.target.value }))} /></label>
        <button className="secondary-button">Apply</button>
      </form>
      {state.loading ? <LoadingState /> : state.error ? <ErrorState error={state.error} /> : purchaseOrders.length === 0 ? <EmptyState title="No purchase orders found" message="Create a draft PO or adjust the filters." /> : <div className="catalog-table-wrap"><table className="catalog-table"><thead><tr><th>PO</th><th>Supplier</th><th>Order date</th><th>Expected</th><th>Items</th><th>Total</th><th>Status</th></tr></thead><tbody>{purchaseOrders.map((po) => <tr key={po.id}><td><a className="table-link" href={'#purchase-orders/' + po.id}>{po.po_number}</a></td><td>{po.supplier_name}</td><td>{po.order_date.slice(0, 10)}</td><td>{po.expected_delivery_date?.slice(0, 10) || 'Not set'}</td><td>{po.item_count}</td><td>{po.grand_total} {po.currency}</td><td><span className={'status-pill ' + po.status}>{po.status.replace('_', ' ')}</span></td></tr>)}</tbody></table><div className="pagination"><span>{meta.total} POs · Page {meta.page} of {meta.totalPages || 1}</span><div><button className="secondary-button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><button className="secondary-button" disabled={page >= meta.totalPages} onClick={() => setPage((value) => value + 1)}>Next</button></div></div></div>}
    </>
  );
}
