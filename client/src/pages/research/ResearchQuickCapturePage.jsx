import { useEffect, useState } from 'react';
import { catalogApi } from '../../api/catalogApi.js';
import { purchasingApi } from '../../api/purchasingApi.js';
import { researchApi } from '../../api/researchApi.js';
import { imageApi } from '../../api/imageApi.js';
import { ErrorState, LoadingState, PageHeader } from '../../components/catalog/CatalogStates.jsx';
import QuickCaptureForm from '../../components/research/QuickCaptureForm.jsx';

export default function ResearchQuickCapturePage({ organizationId }) {
  const [referenceData, setReferenceData] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [savedCandidateId, setSavedCandidateId] = useState(null);

  useEffect(() => {
    Promise.all([
      purchasingApi.listSuppliers(organizationId, { limit: 100, isActive: true }),
      catalogApi.listCategories(organizationId),
    ]).then(([supplierResult, categoryResult]) => {
      setReferenceData({ suppliers: supplierResult.data, categories: categoryResult.data });
    }).catch(setError);
  }, [organizationId]);

  async function submit(body) {
    setSubmitting(true);
    setError(null);
    try {
      const { photoFile, ...capture } = body;
      const result = await researchApi.quickCapture(organizationId, capture);
      setSavedCandidateId(result.data.id);
      try {
        await imageApi.upload(organizationId, photoFile, 'candidate', result.data.id, true);
      } catch (imageError) {
        setError(new Error('The candidate was saved, but its photo could not be stored: ' + imageError.message + ' Open the candidate to retry without creating a duplicate.'));
        setSubmitting(false);
        return;
      }
      window.location.hash = 'research/candidates/' + result.data.id;
    } catch (requestError) {
      setError(requestError);
      setSubmitting(false);
    }
  }

  if (error && !referenceData) return <ErrorState error={error} />;
  if (!referenceData) return <LoadingState label="Preparing quick capture…" />;
  return (
    <>
      <PageHeader eyebrow="Supplier visit" title="Quick Capture" description="Capture the product, supplier, and price now. Market research and economics can wait." />
      {error && <div className="form-error" role="alert">{error.message}</div>}
      {savedCandidateId ? <div className="success-banner">Candidate saved. <a href={'#research/candidates/' + savedCandidateId}>Open it to retry the photo</a>; submitting this form again is disabled to prevent a duplicate.</div> : <QuickCaptureForm {...referenceData} onSubmit={submit} submitting={submitting} />}
    </>
  );
}
