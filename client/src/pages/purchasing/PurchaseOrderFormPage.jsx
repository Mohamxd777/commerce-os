import { useCallback, useEffect, useState } from 'react';
import { catalogApi } from '../../api/catalogApi.js';
import { purchasingApi } from '../../api/purchasingApi.js';
import { LoadingState, PageHeader } from '../../components/catalog/CatalogStates.jsx';
import PurchaseOrderForm from '../../components/purchasing/PurchaseOrderForm.jsx';

export default function PurchaseOrderFormPage({ organizationId, purchaseOrderId }) {
  const [suppliers, setSuppliers] = useState([]);
  const [skus, setSkus] = useState([]);
  const [supplierProducts, setSupplierProducts] = useState([]);
  const [purchaseOrder, setPurchaseOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const loadSupplierProducts = useCallback((supplierId) => {
    if (!supplierId) {
      setSupplierProducts([]);
      return;
    }
    purchasingApi.listSupplierProducts(organizationId, { supplierId, isActive: true, limit: 100 })
      .then((result) => setSupplierProducts(result.data))
      .catch(setError);
  }, [organizationId]);

  useEffect(() => {
    const requests = [
      purchasingApi.listSuppliers(organizationId, { isActive: true, limit: 100 }),
      catalogApi.listSkus(organizationId, { isActive: true, limit: 100 }),
      purchaseOrderId ? purchasingApi.getPurchaseOrder(organizationId, purchaseOrderId) : Promise.resolve(null),
    ];
    Promise.all(requests).then(([supplierResult, skuResult, poResult]) => {
      setSuppliers(supplierResult.data);
      setSkus(skuResult.data);
      if (poResult) {
        if (poResult.data.status !== 'draft') throw new Error('Only draft purchase orders can use the full edit form.');
        setPurchaseOrder(poResult.data);
        loadSupplierProducts(poResult.data.supplier_id);
      }
    }).catch(setError).finally(() => setLoading(false));
  }, [organizationId, purchaseOrderId, loadSupplierProducts]);

  async function submit(payload) {
    setSubmitting(true);
    setError(null);
    try {
      let result;
      if (purchaseOrderId) {
        const patch = { ...payload };
        delete patch.supplierId;
        delete patch.poNumber;
        result = await purchasingApi.patchPurchaseOrder(organizationId, purchaseOrderId, patch);
      } else {
        result = await purchasingApi.createPurchaseOrder(organizationId, payload);
      }
      window.location.hash = 'purchase-orders/' + result.data.id;
    } catch (submitError) {
      setError(submitError);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingState label="Preparing purchase-order form…" />;

  return (
    <>
      <PageHeader eyebrow="Purchasing" title={purchaseOrderId ? 'Edit draft purchase order' : 'Create purchase order'} description="Choose the supplier, review supplier-specific terms, and save server-calculated commercial totals." />
      <PurchaseOrderForm key={purchaseOrder?.updated_at || 'new'} initial={purchaseOrder} suppliers={suppliers} skus={skus} supplierProducts={supplierProducts} onSupplierChange={loadSupplierProducts} onSubmit={submit} submitting={submitting} error={error} />
    </>
  );
}
