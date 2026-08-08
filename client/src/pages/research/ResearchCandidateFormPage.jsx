import { useEffect, useState } from 'react';
import { catalogApi } from '../../api/catalogApi.js';
import { researchApi } from '../../api/researchApi.js';
import CandidateForm from '../../components/research/CandidateForm.jsx';
import { ErrorState, LoadingState, PageHeader } from '../../components/catalog/CatalogStates.jsx';

export default function ResearchCandidateFormPage({ organizationId }) {
  const [categories, setCategories] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => { catalogApi.listCategories(organizationId).then((result) => setCategories(result.data)).catch(setError); }, [organizationId]);
  async function submit(body) {
    setSubmitting(true); setError(null);
    try { const result = await researchApi.createCandidate(organizationId, body); window.location.hash = 'research/candidates/' + result.data.id; }
    catch (requestError) { setError(requestError); setSubmitting(false); }
  }
  if (error && !categories) return <ErrorState error={error} />;
  if (!categories) return <LoadingState label="Preparing candidate form…" />;
  return <><PageHeader eyebrow="Research pipeline" title="Create product candidate" description="This creates a research record only—never catalog stock, supplier inventory, or a purchase order." />{error && <div className="form-error" role="alert">{error.message}</div>}<CandidateForm categories={categories} onSubmit={submit} submitting={submitting} /></>;
}
