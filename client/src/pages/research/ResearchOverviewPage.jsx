import { useEffect, useState } from 'react';
import { researchApi } from '../../api/researchApi.js';
import BusinessTerm from '../../components/BusinessTerm.jsx';
import { ErrorState, LoadingState, PageHeader } from '../../components/catalog/CatalogStates.jsx';
import { money, percent, researchTerms } from '../../components/research/ResearchTerms.js';

export default function ResearchOverviewPage({ organizationId }) {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { researchApi.summary(organizationId).then((result) => setSummary(result.data)).catch(setError); }, [organizationId]);
  if (error) return <ErrorState error={error} />;
  if (!summary) return <LoadingState label="Loading research summary…" />;
  const cards = [
    ['Total candidates', summary.total_candidates, 'All research subjects'],
    ['Shortlisted', summary.shortlisted, 'Candidates ready for sourcing'],
    ['Sampling', summary.sampling, 'Under physical evaluation'],
    ['Approved', summary.approved, 'Ready for controlled conversion'],
    ['Samples pending', summary.samples_pending, 'Awaiting a result'],
    ['Buy recommendations', summary.buy_recommendations, 'Latest launch decisions'],
    ['Average margin', percent(summary.average_margin), 'Across calculated candidates'],
    ['Average ROI', percent(summary.average_roi), 'Across calculated candidates'],
  ];
  return (
    <>
      <PageHeader eyebrow="Task 5 · Product research" title="Research before inventory" description="Capture evidence, compare supplier options, test samples, and make traceable launch decisions before a candidate enters the catalog." action={<div className="header-actions"><a className="secondary-button" href="#research/comparison">Compare candidates</a><a className="primary-button" href="#research/candidates/new">New candidate</a></div>} />
      <div className="summary-grid research-summary-grid">{cards.map(([label, value, description]) => <article className="summary-card" key={label}><span>{label === 'Average ROI' ? <BusinessTerm term="ROI" explanation={researchTerms.ROI} /> : label}</span><strong>{value}</strong><small>{description}</small></article>)}</div>
      <section className={'capital-panel ' + (summary.capital_budget_exceeded ? 'budget-warning' : '')}>
        <div><p className="eyebrow">Capital allocation</p><h2>{money(summary.total_planned_capital, summary.settings.currency)} planned</h2><p>Configured launch budget: {money(summary.settings.launch_budget, summary.settings.currency)} · projected profit: {money(summary.total_projected_profit, summary.settings.currency)}</p></div>
        <div>{summary.capital_budget_exceeded ? <span className="warning-badge">Budget exceeded</span> : <span className="status-pill active">Within budget</span>}<a className="secondary-button" href="#research/settings">Edit thresholds</a></div>
      </section>
    </>
  );
}
