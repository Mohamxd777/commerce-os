import { useEffect, useState } from 'react';
import { purchasingApi } from '../../api/purchasingApi.js';
import { LoadingState, PageHeader } from '../../components/catalog/CatalogStates.jsx';
import SupplierForm from '../../components/purchasing/SupplierForm.jsx';

export default function SupplierFormPage({ organizationId, supplierId }) {
  const [supplier, setSupplier] = useState(null);
  const [loading, setLoading] = useState(Boolean(supplierId));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!supplierId) return;
    purchasingApi.getSupplier(organizationId, supplierId)
      .then((result) => setSupplier(result.data))
      .catch(setError)
      .finally(() => setLoading(false));
  }, [organizationId, supplierId]);

  async function submit(payload) {
    setSubmitting(true);
    setError(null);
    try {
      const result = supplierId
        ? await purchasingApi.patchSupplier(organizationId, supplierId, payload)
        : await purchasingApi.createSupplier(organizationId, payload);
      window.location.hash = 'suppliers/' + result.data.id;
    } catch (submitError) {
      setError(submitError);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingState label="Loading supplier…" />;

  return (
    <>
      <PageHeader eyebrow="Purchasing" title={supplierId ? 'Edit supplier' : 'Add supplier'} description="Contact and commercial defaults stay organization-scoped and can be archived without deleting history." />
      <SupplierForm key={supplier?.updated_at || 'new'} initial={supplier} onSubmit={submit} submitting={submitting} error={error} />
    </>
  );
}
