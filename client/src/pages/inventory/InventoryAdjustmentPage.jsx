import { useEffect, useState } from 'react';
import { catalogApi } from '../../api/catalogApi.js';
import { inventoryApi } from '../../api/inventoryApi.js';
import { purchasingApi } from '../../api/purchasingApi.js';
import { ErrorState, LoadingState, PageHeader } from '../../components/catalog/CatalogStates.jsx';
import InventoryAdjustmentForm from '../../components/inventory/InventoryAdjustmentForm.jsx';

export default function InventoryAdjustmentPage({ organizationId }) {
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
      await inventoryApi.createAdjustment(organizationId, body);
      window.location.hash = 'inventory/stock';
    } catch (requestError) {
      setError(requestError);
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !options) return <ErrorState error={error} />;
  if (!options) return <LoadingState label="Preparing adjustment…" />;
  return <><PageHeader eyebrow="Inventory" title="Record stock adjustment" description="Every correction becomes auditable ledger evidence. Available stock cannot go negative." />{error && <div className="form-error" role="alert">{error.message}</div>}<InventoryAdjustmentForm {...options} onSubmit={submit} submitting={submitting} /></>;
}
