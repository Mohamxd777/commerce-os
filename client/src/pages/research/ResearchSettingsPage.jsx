import { useEffect, useState } from 'react';
import { researchApi } from '../../api/researchApi.js';
import BusinessTerm from '../../components/BusinessTerm.jsx';
import { ErrorState, LoadingState, PageHeader } from '../../components/catalog/CatalogStates.jsx';
import { researchTerms } from '../../components/research/ResearchTerms.js';

export default function ResearchSettingsPage({ organizationId }) {
  const [form, setForm] = useState(null); const [error, setError] = useState(null); const [saved, setSaved] = useState(false);
  useEffect(() => { researchApi.settings(organizationId).then((result) => setForm(result.data)).catch(setError); }, [organizationId]);
  function update(field, value) { setForm((current) => ({ ...current, [field]: value })); }
  async function submit(event) {
    event.preventDefault(); setError(null); setSaved(false);
    try {
      const result = await researchApi.patchSettings(organizationId, {
        minimumMarginPercentage: form.minimum_margin_percentage,
        minimumRoiPercentage: form.minimum_roi_percentage,
        maximumCapitalAllocation: form.maximum_capital_allocation,
        maximumDefectRisk: form.maximum_defect_risk,
        minimumDemandScore: Number(form.minimum_demand_score),
        launchBudget: form.launch_budget, currency: form.currency,
      }); setForm(result.data); setSaved(true);
    } catch (requestError) { setError(requestError); }
  }
  if (error && !form) return <ErrorState error={error} />; if (!form) return <LoadingState label="Loading research settings…" />;
  return <><PageHeader eyebrow="Organization settings" title="Launch thresholds" description="These editable safeguards inform decisions and capital warnings; they are not hard-coded marketplace rules." /><form className="catalog-form" onSubmit={submit}><section className="form-section"><div><h2>Decision thresholds</h2><p>Calibrate the research workspace to the organization’s appetite and launch budget.</p></div><div className="form-grid two-columns"><label><BusinessTerm term="Minimum Net Margin %" explanation={researchTerms['Net Margin']} /><input type="number" min="0" max="100" step="0.0001" value={form.minimum_margin_percentage} onChange={(event) => update('minimum_margin_percentage', event.target.value)} /></label><label><BusinessTerm term="Minimum ROI %" explanation={researchTerms.ROI} /><input type="number" min="0" step="0.0001" value={form.minimum_roi_percentage} onChange={(event) => update('minimum_roi_percentage', event.target.value)} /></label><label>Maximum capital per launch<input type="number" min="0" step="0.0001" value={form.maximum_capital_allocation} onChange={(event) => update('maximum_capital_allocation', event.target.value)} /></label><label>Total launch budget<input type="number" min="0" step="0.0001" value={form.launch_budget} onChange={(event) => update('launch_budget', event.target.value)} /></label><label>Maximum defect risk<select value={form.maximum_defect_risk} onChange={(event) => update('maximum_defect_risk', event.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label><label>Minimum demand score<input type="number" min="1" max="5" value={form.minimum_demand_score} onChange={(event) => update('minimum_demand_score', event.target.value)} /></label><label>Currency<input pattern="[A-Za-z]{3}" value={form.currency} onChange={(event) => update('currency', event.target.value.toUpperCase())} /></label></div></section>{error && <div className="form-error" role="alert">{error.message}</div>}{saved && <div className="success-banner">Research thresholds saved.</div>}<div className="form-actions"><button className="primary-button">Save settings</button></div></form></>;
}
