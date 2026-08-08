import { apiRequest, queryString } from './catalogApi.js';

export const purchasingApi = {
  getSummary: (organizationId, parameters = {}) =>
    apiRequest('/purchasing-summary?' + queryString(parameters), { organizationId }),

  listSuppliers: (organizationId, parameters = {}) =>
    apiRequest('/suppliers?' + queryString({ page: 1, limit: 25, ...parameters }), {
      organizationId,
    }),
  getSupplier: (organizationId, id) =>
    apiRequest('/suppliers/' + id, { organizationId }),
  createSupplier: (organizationId, body) =>
    apiRequest('/suppliers', { organizationId, method: 'POST', body }),
  patchSupplier: (organizationId, id, body) =>
    apiRequest('/suppliers/' + id, { organizationId, method: 'PATCH', body }),

  listSupplierProducts: (organizationId, parameters = {}) =>
    apiRequest('/supplier-products?' + queryString({ page: 1, limit: 100, ...parameters }), {
      organizationId,
    }),
  createSupplierProduct: (organizationId, body) =>
    apiRequest('/supplier-products', { organizationId, method: 'POST', body }),
  patchSupplierProduct: (organizationId, id, body) =>
    apiRequest('/supplier-products/' + id, { organizationId, method: 'PATCH', body }),
  updateSupplierPrice: (organizationId, id, body) =>
    apiRequest('/supplier-products/' + id + '/price', {
      organizationId,
      method: 'POST',
      body,
    }),
  compareSkuSuppliers: (organizationId, skuId, parameters = {}) =>
    apiRequest('/skus/' + skuId + '/suppliers?' + queryString({
      page: 1,
      limit: 25,
      ...parameters,
    }), { organizationId }),

  listPurchaseOrders: (organizationId, parameters = {}) =>
    apiRequest('/purchase-orders?' + queryString({ page: 1, limit: 25, ...parameters }), {
      organizationId,
    }),
  getPurchaseOrder: (organizationId, id) =>
    apiRequest('/purchase-orders/' + id, { organizationId }),
  createPurchaseOrder: (organizationId, body) =>
    apiRequest('/purchase-orders', { organizationId, method: 'POST', body }),
  patchPurchaseOrder: (organizationId, id, body) =>
    apiRequest('/purchase-orders/' + id, { organizationId, method: 'PATCH', body }),
  approvePurchaseOrder: (organizationId, id) =>
    apiRequest('/purchase-orders/' + id + '/approve', {
      organizationId,
      method: 'POST',
    }),
  markPurchaseOrderOrdered: (organizationId, id) =>
    apiRequest('/purchase-orders/' + id + '/mark-ordered', {
      organizationId,
      method: 'POST',
    }),
  cancelPurchaseOrder: (organizationId, id) =>
    apiRequest('/purchase-orders/' + id + '/cancel', {
      organizationId,
      method: 'POST',
    }),

  listGoodsReceipts: (organizationId, parameters = {}) =>
    apiRequest('/goods-receipts?' + queryString({ page: 1, limit: 25, ...parameters }), {
      organizationId,
    }),
  getGoodsReceipt: (organizationId, id) =>
    apiRequest('/goods-receipts/' + id, { organizationId }),
  createGoodsReceipt: (organizationId, purchaseOrderId, body) =>
    apiRequest('/purchase-orders/' + purchaseOrderId + '/receipts', {
      organizationId,
      method: 'POST',
      body,
    }),

  listLocations: (organizationId, parameters = {}) =>
    apiRequest('/locations?' + queryString({ page: 1, limit: 100, status: 'active', ...parameters }), {
      organizationId,
    }),
  createLocation: (organizationId, body) =>
    apiRequest('/locations', { organizationId, method: 'POST', body }),
};
