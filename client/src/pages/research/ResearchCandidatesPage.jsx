import { useEffect, useState } from 'react';
import { catalogApi } from '../../api/catalogApi.js';
import { researchApi } from '../../api/researchApi.js';
import { ErrorState, LoadingState, PageHeader } from '../../components/catalog/CatalogStates.jsx';
import { money, percent } from '../../components/research/ResearchTerms.js';

export default function ResearchCandidatesPage({ organizationId }) {
  const [candidates, setCandidates] = useState(null);
  const [categories, setCategories] = useState([]);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ search: '', status: '', categoryId: '', decision: '', risk: '', supplier: '', sample: '', page: 1 });
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    catalogApi.listCategories(organizationId).then((result) => setCategories(result.data)).catch(setError);
  }, [organizationId]);

  useEffect(() => {
    const timer = setTimeout(() => researchApi.listCandidates(organizationId, filters).then((result) => {
      setCandidates(result.data); setMeta(result.meta);
    }).catch(setError), 150);
    return () => clearTimeout(timer);
  }, [organizationId, filters]);

  function toggle(id) { setSelected((ids) => ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]); }
  function filter(field, value) { setFilters((current) => ({ ...current, [field]: value, page: field === 'page' ? value : 1 })); }
  if (error && !candidates) return <ErrorState error={error} />;
  return (
    <>
      <PageHeader eyebrow="Product research" title="Candidate pipeline" description="Search and filter server-side, then open a candidate for evidence, supplier, sample, and economics history." action={<a className="primary-button" href="#research/candidates/new">New candidate</a>} />
      <div className="filters research-filters">
        <input aria-label="Search candidates" placeholder="Search name, brand, URL, notes…" value={filters.search} onChange={(event) => filter('search', event.target.value)} />
        <select aria-label="Candidate status" value={filters.status} onChange={(event) => filter('status', event.target.value)}><option value="">All statuses</option>{['research', 'shortlisted', 'sourcing', 'sampling', 'approved', 'rejected', 'launched'].map((status) => <option key={status} value={status}>{status}</option>)}</select>
        <select aria-label="Candidate category" value={filters.categoryId} onChange={(event) => filter('categoryId', event.target.value)}><option value="">All categories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
        <select aria-label="Latest decision" value={filters.decision} onChange={(event) => filter('decision', event.target.value)}><option value="">All decisions</option><option value="buy">Buy</option><option value="maybe">Maybe</option><option value="reject">Reject</option><option value="needs_more_research">Needs more research</option></select>
        <select aria-label="Risk level" value={filters.risk} onChange={(event) => filter('risk', event.target.value)}><option value="">All risk levels</option><option value="low">Low risk</option><option value="medium">Medium risk</option><option value="high">High risk</option></select>
        <select aria-label="Supplier option" value={filters.supplier} onChange={(event) => filter('supplier', event.target.value)}><option value="">Supplier: any</option><option value="true">Has supplier</option><option value="false">No supplier</option></select>
        <select aria-label="Sample presence" value={filters.sample} onChange={(event) => filter('sample', event.target.value)}><option value="">Sample: any</option><option value="true">Has sample</option><option value="false">No sample</option></select>
        {selected.length >= 2 && <a className="secondary-button" href={'#research/comparison/' + selected.join(',')}>Compare {selected.length}</a>}
      </div>
      {!candidates ? <LoadingState label="Loading candidates…" /> : candidates.length === 0 ? <div className="empty-state"><h2>No candidates found</h2><p>Start with one product hypothesis and its evidence.</p></div> : <><div className="catalog-table-wrap"><table className="catalog-table research-table"><thead><tr><th>Select</th><th>Candidate</th><th>Status</th><th>Market</th><th>Supplier</th><th>Sample</th><th>Margin / ROI</th><th>Decision</th></tr></thead><tbody>{candidates.map((candidate) => <tr key={candidate.id}><td><input aria-label={'Compare ' + candidate.name} type="checkbox" checked={selected.includes(candidate.id)} onChange={() => toggle(candidate.id)} /></td><td><a className="table-link" href={'#research/candidates/' + candidate.id}>{candidate.name}</a><small>{candidate.brand_name || candidate.category_name || 'Uncategorized'}</small></td><td><span className={'status-pill ' + candidate.status}>{candidate.status}</span></td><td>{money(candidate.market_price, candidate.market_currency || 'EGP')}<small>{candidate.demand_score ? 'Demand ' + candidate.demand_score + '/5' : 'No snapshot'}</small></td><td>{candidate.preferred_supplier_name || '—'}<small>{candidate.moq ? 'MOQ ' + Number(candidate.moq) : 'No quote'}</small></td><td>{candidate.sample_result || '—'}</td><td>{percent(candidate.net_margin_percentage)}<small>{percent(candidate.roi_percentage)} ROI</small></td><td>{candidate.recommendation || '—'}<small>{candidate.risk_level ? candidate.risk_level + ' risk' : 'Not evaluated'}</small></td></tr>)}</tbody></table></div>{meta && <div className="pagination-bar"><span>Page {meta.page} of {meta.totalPages || 1} · {meta.total} candidates</span><div><button className="secondary-button" disabled={meta.page <= 1} onClick={() => filter('page', meta.page - 1)}>Previous</button><button className="secondary-button" disabled={meta.page >= meta.totalPages} onClick={() => filter('page', meta.page + 1)}>Next</button></div></div>}</>}
    </>
  );
}
