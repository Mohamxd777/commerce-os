import { useEffect, useState } from 'react';
import { purchasingApi } from '../../api/purchasingApi.js';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/catalog/CatalogStates.jsx';

export default function SuppliersPage({ organizationId }) {
  const [suppliers, setSuppliers] = useState([]);
  const [meta, setMeta] = useState({ page: 1, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState({ search: '', isActive: '' });
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ loading: true, error: null });

  useEffect(() => {
    purchasingApi.listSuppliers(organizationId, { ...applied, page, limit: 25 })
      .then((result) => {
        setSuppliers(result.data);
        setMeta(result.meta);
        setState({ loading: false, error: null });
      })
      .catch((error) => setState({ loading: false, error }));
  }, [organizationId, applied, page]);

  return (
    <>
      <PageHeader
        eyebrow="Purchasing"
        title="Suppliers"
        description="Search organization-owned suppliers, contact details, linked SKUs, and purchasing history."
        action={<a className="primary-button" href="#suppliers/new">Add supplier</a>}
      />
      <form className="catalog-filters sku-filters" onSubmit={(event) => { event.preventDefault(); setPage(1); setApplied(filters); }}>
        <input aria-label="Search suppliers" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Name, contact, or email" />
        <select aria-label="Filter suppliers by status" value={filters.isActive} onChange={(event) => setFilters((current) => ({ ...current, isActive: event.target.value }))}><option value="">All statuses</option><option value="true">Active</option><option value="false">Archived</option></select>
        <button className="secondary-button">Apply</button>
      </form>
      {state.loading ? <LoadingState /> : state.error ? <ErrorState error={state.error} /> : suppliers.length === 0 ? <EmptyState title="No suppliers found" message="Add a supplier or adjust the filters." /> : (
        <div className="catalog-table-wrap">
          <table className="catalog-table">
            <thead><tr><th>Supplier</th><th>Contact</th><th>Terms</th><th>Linked SKUs</th><th>POs</th><th>Status</th></tr></thead>
            <tbody>{suppliers.map((supplier) => (
              <tr key={supplier.id}>
                <td><a className="table-link" href={'#suppliers/' + supplier.id}>{supplier.name}</a><small>{supplier.legal_name || 'No legal name'}</small></td>
                <td>{supplier.contact_person || '—'}<small>{supplier.email || supplier.phone || 'No contact method'}</small></td>
                <td>{supplier.payment_terms_days === null ? 'Not set' : supplier.payment_terms_days + ' days'}<small>{supplier.preferred_currency}</small></td>
                <td>{supplier.linked_sku_count}</td><td>{supplier.purchase_order_count}</td>
                <td><span className={'status-pill ' + (supplier.is_active ? 'active' : 'archived')}>{supplier.is_active ? 'active' : 'archived'}</span></td>
              </tr>
            ))}</tbody>
          </table>
          <div className="pagination"><span>{meta.total} suppliers · Page {meta.page} of {meta.totalPages || 1}</span><div><button className="secondary-button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><button className="secondary-button" disabled={page >= meta.totalPages} onClick={() => setPage((value) => value + 1)}>Next</button></div></div>
        </div>
      )}
    </>
  );
}
