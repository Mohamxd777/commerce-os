import { useEffect, useState } from 'react';
import { researchApi } from '../../api/researchApi.js';
import BusinessTerm from '../../components/BusinessTerm.jsx';
import { ErrorState, LoadingState, PageHeader } from '../../components/catalog/CatalogStates.jsx';
import { money, percent, researchTerms } from '../../components/research/ResearchTerms.js';

export default function ResearchComparisonPage({ organizationId, initialIds = [] }) {
  const [all, setAll] = useState(null);
  const [selected, setSelected] = useState(initialIds);
  const [comparison, setComparison] = useState([]);
  const [error, setError] = useState(null);
  useEffect(() => { researchApi.listCandidates(organizationId, { limit: 100 }).then((result) => setAll(result.data)).catch(setError); }, [organizationId]);
  useEffect(() => {
    if (selected.length < 2) return undefined;
    let cancelled = false;
    researchApi.compare(organizationId, selected)
      .then((result) => { if (!cancelled) setComparison(result.data); })
      .catch(setError);
    return () => { cancelled = true; };
  }, [organizationId, selected]);
  function toggle(id) { setSelected((ids) => ids.includes(id) ? ids.filter((value) => value !== id) : ids.length < 10 ? [...ids, id] : ids); }
  if (error && !all) return <ErrorState error={error} />;
  if (!all) return <LoadingState label="Loading comparison workspace…" />;
  const visibleComparison = selected.length >= 2 ? comparison : [];
  const rows = [
    ['Status', (c) => c.status], ['Market price', (c) => money(c.market_price, c.market_currency || 'EGP')],
    ['Demand / competition', (c) => (c.demand_score || '—') + ' / ' + (c.competition_score || '—')],
    ['Supplier', (c) => c.preferred_supplier_name || '—'], ['Unit cost', (c) => money(c.quoted_unit_cost, c.supplier_currency || 'EGP')],
    ['MOQ', (c) => c.moq ? Number(c.moq) : '—'], ['Lead Time', (c) => c.lead_time_days ?? '—'],
    ['Sample', (c) => c.sample_result || '—'], ['Net Margin', (c) => percent(c.net_margin_percentage)],
    ['ROI', (c) => percent(c.roi_percentage)], ['Contribution', (c) => money(c.net_contribution, c.market_currency || 'EGP')],
    ['Decision / risk', (c) => (c.recommendation || '—') + ' / ' + (c.risk_level || '—')],
    ['Planned capital', (c) => money(c.planned_capital, c.market_currency || 'EGP')],
  ];
  return <><PageHeader eyebrow="Decision support" title="Candidate comparison" description="Select two to ten organization-owned candidates. Values come from each candidate’s latest research records." />
    <section className="candidate-picker" aria-label="Candidate picker">{all.map((candidate) => <label key={candidate.id}><input type="checkbox" checked={selected.includes(candidate.id)} onChange={() => toggle(candidate.id)} />{candidate.name}</label>)}</section>
    {selected.length < 2 ? <div className="empty-state"><h2>Select at least two candidates</h2><p>Comparison is intentionally limited to the candidates you choose.</p></div> : visibleComparison.length ? <div className="catalog-table-wrap"><table className="comparison-table"><thead><tr><th>Metric</th>{visibleComparison.map((candidate) => <th key={candidate.id}><a href={'#research/candidates/' + candidate.id}>{candidate.name}</a></th>)}</tr></thead><tbody>{rows.map(([label, render]) => <tr key={label}><th>{researchTerms[label] ? <BusinessTerm term={label} explanation={researchTerms[label]} /> : label}</th>{visibleComparison.map((candidate) => <td key={candidate.id}>{render(candidate)}</td>)}</tr>)}</tbody></table></div> : <LoadingState label="Comparing candidates…" />}
    {error && <div className="form-error" role="alert">{error.message}</div>}
  </>;
}
