import { useEffect, useState } from 'react';
import { purchasingApi } from '../../api/purchasingApi.js';
import BusinessTerm from '../../components/BusinessTerm.jsx';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/catalog/CatalogStates.jsx';
import { purchasingTerms } from '../../components/purchasing/PurchasingTerms.js';

export default function GoodsReceiptsPage({ organizationId }) {
  const [receipts, setReceipts] = useState([]);
  const [meta, setMeta] = useState({ page: 1, total: 0, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ loading: true, error: null });

  useEffect(() => {
    purchasingApi.listGoodsReceipts(organizationId, { search: applied, page, limit: 25 })
      .then((result) => { setReceipts(result.data); setMeta(result.meta); setState({ loading: false, error: null }); })
      .catch((error) => setState({ loading: false, error }));
  }, [organizationId, applied, page]);

  return (
    <>
      <PageHeader eyebrow="Purchasing" title={<BusinessTerm term="Goods Receipts" explanation={purchasingTerms['Goods Receipt']} />} description="Immutable delivery evidence. Open a receipt to post accepted quantities to inventory exactly once." />
      <form className="catalog-filters sku-filters" onSubmit={(event) => { event.preventDefault(); setPage(1); setApplied(search); }}><input aria-label="Search goods receipts" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Receipt, PO, or supplier" /><button className="secondary-button">Search</button></form>
      {state.loading ? <LoadingState /> : state.error ? <ErrorState error={state.error} /> : receipts.length === 0 ? <EmptyState title="No goods receipts" message="Open an ordered PO and use its receiving flow." /> : <div className="catalog-table-wrap"><table className="catalog-table"><thead><tr><th>Receipt</th><th>PO</th><th>Supplier</th><th>Date</th><th>Location</th><th>Accepted</th><th>Rejected</th></tr></thead><tbody>{receipts.map((receipt) => <tr key={receipt.id}><td><a className="table-link" href={'#goods-receipts/' + receipt.id}>{receipt.receipt_number}</a></td><td><a className="table-link" href={'#purchase-orders/' + receipt.purchase_order_id}>{receipt.po_number}</a></td><td>{receipt.supplier_name}</td><td>{receipt.received_date.slice(0, 10)}</td><td>{receipt.location_name}</td><td>{receipt.accepted_quantity}</td><td>{receipt.rejected_quantity}</td></tr>)}</tbody></table><div className="pagination"><span>{meta.total} receipts · Page {meta.page} of {meta.totalPages || 1}</span><div><button className="secondary-button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><button className="secondary-button" disabled={page >= meta.totalPages} onClick={() => setPage((value) => value + 1)}>Next</button></div></div></div>}
    </>
  );
}
