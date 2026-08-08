import { useEffect, useState } from 'react';
import { catalogApi } from '../../api/catalogApi.js';
import BusinessTerm from '../../components/BusinessTerm.jsx';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/catalog/CatalogStates.jsx';

export default function SkusPage({ organizationId }) {
  const [skus, setSkus] = useState([]);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [meta, setMeta] = useState({ total: 0 });
  const [state, setState] = useState({ loading: true, error: null });

  useEffect(() => {
    catalogApi.listSkus(organizationId, { search: appliedSearch })
      .then((result) => {
        setSkus(result.data);
        setMeta(result.meta);
        setState({ loading: false, error: null });
      })
      .catch((error) => setState({ loading: false, error }));
  }, [organizationId, appliedSearch, refresh]);

  async function toggle(sku, field) {
    await catalogApi.patchSku(organizationId, sku.id, {
      [field]: field === 'isActive' ? !sku.is_active : !sku.serial_tracking_enabled,
    });
    setRefresh((current) => current + 1);
  }

  return (
    <>
      <PageHeader title="SKUs" description="SKU codes identify sellable units and remain immutable through ordinary editing." />
      <form className="catalog-filters sku-filters" onSubmit={(event) => { event.preventDefault(); setAppliedSearch(search); }}>
        <input aria-label="Search SKUs" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search SKU, product, model, or brand" />
        <button className="secondary-button">Search</button>
      </form>
      {state.loading ? <LoadingState /> : state.error ? <ErrorState error={state.error} /> : skus.length === 0 ? <EmptyState title="No SKUs found" message="Create a product with at least one variant and SKU." /> : (
        <div className="catalog-table-wrap">
          <table className="catalog-table">
            <thead><tr><th><BusinessTerm term="SKU" explanation="كود داخلي مميز لكل نسخة قابلة للبيع من المنتج." /></th><th>Product / Variant</th><th>Barcodes</th><th>Serial tracking</th><th>Suppliers</th><th>Status</th></tr></thead>
            <tbody>{skus.map((sku) => (
              <tr key={sku.id}>
                <td><strong>{sku.sku_code}</strong><small>{sku.manufacturer_part_number || 'No MPN'}</small></td>
                <td><a className="table-link" href={'#products/' + sku.product_id}>{sku.product_name}</a><small>{sku.variant_name}</small></td>
                <td>{sku.barcode_count}</td>
                <td><button className="text-button" onClick={() => toggle(sku, 'serialTrackingEnabled')}>{sku.serial_tracking_enabled ? 'Required' : 'Not required'}</button></td>
                <td><a className="table-link" href={'#skus/' + sku.id + '/suppliers'}>Compare suppliers</a></td>
                <td><button className="text-button" onClick={() => toggle(sku, 'isActive')}>{sku.is_active ? 'Active' : 'Archived'}</button></td>
              </tr>
            ))}</tbody>
          </table>
          <div className="pagination"><span>{meta.total} SKUs</span></div>
        </div>
      )}
    </>
  );
}
