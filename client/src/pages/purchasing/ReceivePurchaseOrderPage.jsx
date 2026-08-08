import { useCallback, useEffect, useState } from 'react';
import { purchasingApi } from '../../api/purchasingApi.js';
import { ErrorState, LoadingState, PageHeader } from '../../components/catalog/CatalogStates.jsx';
import ReceivingForm from '../../components/purchasing/ReceivingForm.jsx';

export default function ReceivePurchaseOrderPage({ organizationId, purchaseOrderId }) {
  const [purchaseOrder, setPurchaseOrder] = useState(null);
  const [locations, setLocations] = useState([]);
  const [locationDraft, setLocationDraft] = useState({ name: '', code: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const loadLocations = useCallback(() => {
    purchasingApi.listLocations(organizationId)
      .then((result) => setLocations(result.data))
      .catch(setError);
  }, [organizationId]);

  useEffect(() => {
    purchasingApi.getPurchaseOrder(organizationId, purchaseOrderId)
      .then((result) => setPurchaseOrder(result.data))
      .catch(setError);
    loadLocations();
  }, [organizationId, purchaseOrderId, loadLocations]);

  async function createLocation(event) {
    event.preventDefault();
    try {
      await purchasingApi.createLocation(organizationId, {
        name: locationDraft.name,
        code: locationDraft.code,
        locationType: 'warehouse',
        countryCode: 'EG',
        timezone: 'Africa/Cairo',
      });
      setLocationDraft({ name: '', code: '' });
      loadLocations();
    } catch (locationError) {
      setError(locationError);
    }
  }

  async function submit(payload) {
    setSubmitting(true);
    setError(null);
    try {
      const result = await purchasingApi.createGoodsReceipt(organizationId, purchaseOrderId, payload);
      window.location.hash = 'goods-receipts/' + result.data.id;
    } catch (submitError) {
      setError(submitError);
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !purchaseOrder) return <ErrorState error={error} />;
  if (!purchaseOrder) return <LoadingState label="Preparing receiving flow…" />;

  return (
    <>
      <PageHeader eyebrow="Receiving" title={'Receive ' + purchaseOrder.po_number} description="Record accepted and rejected quantities against an active receiving location." />
      {locations.length === 0 && <form className="inline-create-form receiving-location-form" onSubmit={createLocation}><label>Location name<input required value={locationDraft.name} onChange={(event) => setLocationDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Main warehouse" /></label><label>Code<input required value={locationDraft.code} onChange={(event) => setLocationDraft((current) => ({ ...current, code: event.target.value.toUpperCase() }))} placeholder="MAIN" /></label><button className="primary-button">Create receiving location</button></form>}
      <ReceivingForm purchaseOrder={purchaseOrder} locations={locations} onSubmit={submit} submitting={submitting} error={error} />
    </>
  );
}
