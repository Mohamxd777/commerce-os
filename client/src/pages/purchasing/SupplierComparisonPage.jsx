import { useEffect, useState } from 'react';
import { purchasingApi } from '../../api/purchasingApi.js';
import BusinessTerm from '../../components/BusinessTerm.jsx';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/catalog/CatalogStates.jsx';
import { purchasingTerms } from '../../components/purchasing/PurchasingTerms.js';

export default function SupplierComparisonPage({ organizationId, skuId }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    purchasingApi.compareSkuSuppliers(organizationId, skuId)
      .then(setResult)
      .catch(setError);
  }, [organizationId, skuId]);

  if (error) return <ErrorState error={error} />;
  if (!result) return <LoadingState label="Loading supplier comparison…" />;

  return (
    <>
      <PageHeader eyebrow="Supplier comparison" title={result.meta.sku.sku_code} description={`${result.meta.sku.product_name} · ${result.meta.sku.variant_name}. Compare options without automatic supplier selection.`} />
      {result.data.length === 0 ? <EmptyState title="No supplier options" message="Link this SKU from a supplier detail page." /> : <div className="catalog-table-wrap"><table className="catalog-table"><thead><tr><th>Supplier</th><th><BusinessTerm term="Unit Cost" explanation={purchasingTerms['Unit Cost']} /></th><th><BusinessTerm term="MOQ" explanation={purchasingTerms.MOQ} /></th><th><BusinessTerm term="Lead Time" explanation={purchasingTerms['Lead Time']} /></th><th>Preferred</th><th>Last price update</th><th>Status</th></tr></thead><tbody>{result.data.map((item) => <tr key={item.id}><td><a className="table-link" href={'#suppliers/' + item.supplier_id}>{item.supplier_name}</a><small>{item.supplier_sku_code || 'No supplier SKU code'}</small></td><td>{item.current_unit_cost} {item.currency}</td><td>{item.moq}</td><td>{item.lead_time_days} days</td><td>{item.preferred ? 'Preferred' : '—'}</td><td>{item.last_price_update ? new Date(item.last_price_update).toLocaleDateString() : '—'}</td><td><span className={'status-pill ' + (item.is_active ? 'active' : 'archived')}>{item.is_active ? 'active' : 'inactive'}</span></td></tr>)}</tbody></table></div>}
    </>
  );
}
