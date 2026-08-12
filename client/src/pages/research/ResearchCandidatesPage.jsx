import { useEffect, useState } from 'react';
import { catalogApi } from '../../api/catalogApi.js';
import { purchasingApi } from '../../api/purchasingApi.js';
import { researchApi } from '../../api/researchApi.js';
import { ErrorState, LoadingState, PageHeader } from '../../components/catalog/CatalogStates.jsx';
import ResearchWorkflow from '../../components/research/ResearchWorkflow.jsx';
import { money, percent } from '../../components/research/ResearchTerms.js';

const statusLabels = {
  research: 'Researching', shortlisted: 'Shortlisted', sourcing: 'Researching',
  sampling: 'Sample Required', approved: 'Approved', rejected: 'Rejected', launched: 'Launched / Converted',
};

const decisionLabels = {
  buy: 'Approve / buy', maybe: 'Shortlist', reject: 'Reject', needs_more_research: 'Needs research',
};

export default function ResearchCandidatesPage({ organizationId }) {
  const [candidates, setCandidates] = useState(null);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ search: '', status: '', categoryId: '', supplierId: '', decision: '', risk: '', page: 1 });

  useEffect(() => {
    Promise.all([
      catalogApi.listCategories(organizationId),
      purchasingApi.listSuppliers(organizationId, { limit: 100, isActive: true }),
    ]).then(([categoryResult, supplierResult]) => {
      setCategories(categoryResult.data);
      setSuppliers(supplierResult.data);
    }).catch(setError);
  }, [organizationId]);

  useEffect(() => {
    const timer = setTimeout(() => researchApi.listCandidates(organizationId, filters).then((result) => {
      setCandidates(result.data);
      setMeta(result.meta);
      setError(null);
    }).catch(setError), 150);
    return () => clearTimeout(timer);
  }, [organizationId, filters]);

  function filter(field, value) {
    setFilters((current) => ({ ...current, [field]: value, page: field === 'page' ? value : 1 }));
  }

  if (error && !candidates) return <ErrorState error={error} />;
  return (
    <>
      <PageHeader
        eyebrow="Noon Egypt sourcing workflow"
        title="Product Research"
        description="Move each idea from a supplier quote to market evidence, economics, sample, decision, and an explicit draft SKU."
        action={<div className="header-actions"><a className="secondary-button" href="#research/quick-capture">Quick Capture</a><a className="primary-button" href="#research/candidates/new">Add Candidate</a></div>}
      />

      <div className="filters research-workspace-filters">
        <input aria-label="Search candidates" placeholder="Search product, supplier, model, barcode…" value={filters.search} onChange={(event) => filter('search', event.target.value)} />
        <select aria-label="Candidate status" value={filters.status} onChange={(event) => filter('status', event.target.value)}><option value="">All statuses</option><option value="research">Researching</option><option value="shortlisted">Shortlisted</option><option value="sampling">Sample Required</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="launched">Launched / Converted</option></select>
        <select aria-label="Candidate category" value={filters.categoryId} onChange={(event) => filter('categoryId', event.target.value)}><option value="">All categories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
        <select aria-label="Supplier" value={filters.supplierId} onChange={(event) => filter('supplierId', event.target.value)}><option value="">All suppliers</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select>
        <select aria-label="Latest decision" value={filters.decision} onChange={(event) => filter('decision', event.target.value)}><option value="">All decisions</option><option value="buy">Approve / buy</option><option value="maybe">Shortlist</option><option value="reject">Reject</option><option value="needs_more_research">Needs research</option></select>
        <select aria-label="Risk level" value={filters.risk} onChange={(event) => filter('risk', event.target.value)}><option value="">All risk</option><option value="low">Low risk</option><option value="medium">Medium risk</option><option value="high">High risk</option></select>
      </div>

      {error && <div className="form-error" role="alert">{error.message}</div>}
      {!candidates ? <LoadingState label="Loading product research…" /> : candidates.length === 0 ? <div className="empty-state research-empty"><h2>No candidates match this view</h2><p>Capture a supplier quote in under a minute, or add a fuller product idea.</p><div className="header-actions"><a className="secondary-button" href="#research/quick-capture">Quick Capture</a><a className="primary-button" href="#research/candidates/new">Add Candidate</a></div></div> : (
        <>
          <div className="catalog-table-wrap research-workspace-table"><table className="catalog-table"><thead><tr><th>Product</th><th>Best supplier cost</th><th>Planned / observed price</th><th>Margin / ROI</th><th>Sample</th><th>Decision</th><th>Risk</th><th>Progress / updated</th></tr></thead><tbody>{candidates.map((candidate) => {
            const supplierCost = candidate.quoted_unit_cost ?? candidate.cheapest_unit_cost;
            const supplierCurrency = candidate.supplier_currency || candidate.cheapest_supplier_currency || 'EGP';
            return <tr key={candidate.id}>
              <td data-label="Product"><a className="table-link" href={'#research/candidates/' + candidate.id}>{candidate.name}</a><small>{candidate.category_name || 'Uncategorized'}{candidate.model_number ? ' · ' + candidate.model_number : ''}</small></td>
              <td data-label="Supplier cost"><strong>{money(supplierCost, supplierCurrency)}</strong><small>{candidate.preferred_supplier_name || (candidate.cheapest_supplier_name ? candidate.cheapest_supplier_name + ' · cheapest, not selected' : 'No supplier quote')}</small></td>
              <td data-label="Selling price"><strong>{money(candidate.planned_selling_price, candidate.planned_price_currency || 'EGP')}</strong><small>Observed {money(candidate.median_observed_price ?? candidate.market_price, candidate.market_currency || 'EGP')}</small></td>
              <td data-label="Economics"><strong>{percent(candidate.net_margin_percentage)}</strong><small>{percent(candidate.roi_percentage)} ROI</small></td>
              <td data-label="Sample"><span className={'status-pill ' + (candidate.sample_state || 'not_requested')}>{(candidate.sample_state || 'not_requested').replaceAll('_', ' ')}</span></td>
              <td data-label="Decision"><strong>{decisionLabels[candidate.recommendation] || statusLabels[candidate.status]}</strong><small>{statusLabels[candidate.status]}</small></td>
              <td data-label="Risk"><span className={'risk-badge ' + (candidate.risk_level || 'unknown')}>{candidate.risk_level ? candidate.risk_level + ' risk' : 'Not set'}</span></td>
              <td data-label="Progress"><ResearchWorkflow currentStage={candidate.current_stage} /><small>{new Date(candidate.updated_at).toLocaleDateString()}</small></td>
            </tr>;
          })}</tbody></table></div>
          {meta && <div className="pagination-bar"><span>Page {meta.page} of {meta.totalPages || 1} · {meta.total} candidates</span><div><button className="secondary-button" disabled={meta.page <= 1} onClick={() => filter('page', meta.page - 1)}>Previous</button><button className="secondary-button" disabled={meta.page >= meta.totalPages} onClick={() => filter('page', meta.page + 1)}>Next</button></div></div>}
        </>
      )}
    </>
  );
}
