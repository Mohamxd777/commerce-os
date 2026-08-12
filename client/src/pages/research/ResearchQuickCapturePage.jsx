import { useEffect, useState } from 'react';
import { catalogApi } from '../../api/catalogApi.js';
import { purchasingApi } from '../../api/purchasingApi.js';
import { researchApi } from '../../api/researchApi.js';
import { ErrorState, LoadingState, PageHeader } from '../../components/catalog/CatalogStates.jsx';
import QuickCaptureForm from '../../components/research/QuickCaptureForm.jsx';

export default function ResearchQuickCapturePage({ organizationId }) {
  const [referenceData, setReferenceData] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

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
      const result = await researchApi.quickCapture(organizationId, body);
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
      <QuickCaptureForm {...referenceData} onSubmit={submit} submitting={submitting} />
    </>
  );
}
