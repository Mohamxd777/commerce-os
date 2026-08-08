import { useEffect, useState } from 'react';
import { catalogApi } from '../../api/catalogApi.js';
import { inventoryApi } from '../../api/inventoryApi.js';
import { purchasingApi } from '../../api/purchasingApi.js';
import { ErrorState, LoadingState, PageHeader } from '../../components/catalog/CatalogStates.jsx';
import TransferForm from '../../components/inventory/TransferForm.jsx';

export default function InventoryTransferFormPage({ organizationId }) {
  const [options, setOptions] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    Promise.all([
      catalogApi.listSkus(organizationId, { limit: 100, isActive: true }),
      purchasingApi.listLocations(organizationId),
    ]).then(([skus, locations]) => setOptions({ skus: skus.data, locations: locations.data })).catch(setError);
  }, [organizationId]);

  async function submit(body) {
    setSubmitting(true);
    setError(null);
    try {
      const result = await inventoryApi.createTransfer(organizationId, body);
      window.location.hash = 'inventory/transfers/' + result.data.id;
    } catch (requestError) {
      setError(requestError);
    } finally {
      setSubmitting(false);
    }
  }
  if (error && !options) return <ErrorState error={error} />;
  if (!options) return <LoadingState label="Preparing transfer…" />;
  return <><PageHeader eyebrow="Inventory transfer" title="Create draft transfer" description="Draft creation reserves no stock and creates no movement. Stock leaves only when shipped." />{error && <div className="form-error" role="alert">{error.message}</div>}<TransferForm {...options} onSubmit={submit} submitting={submitting} /></>;
}
