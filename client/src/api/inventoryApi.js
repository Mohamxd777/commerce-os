import { apiRequest, queryString } from './catalogApi.js';

export const inventoryApi = {
  listStock: (organizationId, parameters = {}) =>
    apiRequest('/inventory?' + queryString({ page: 1, limit: 25, ...parameters }), {
      organizationId,
    }),
  getSummary: (organizationId) =>
    apiRequest('/inventory/summary', { organizationId }),
  listMovements: (organizationId, parameters = {}) =>
    apiRequest('/inventory/movements?' + queryString({ page: 1, limit: 25, ...parameters }), {
      organizationId,
    }),
  getSkuInventory: (organizationId, skuId) =>
    apiRequest('/skus/' + skuId + '/inventory', { organizationId }),
  createAdjustment: (organizationId, body) =>
    apiRequest('/inventory/adjustments', { organizationId, method: 'POST', body }),
  reconcile: (organizationId) =>
    apiRequest('/inventory/reconciliation', { organizationId }),

  listReorderRules: (organizationId, parameters = {}) =>
    apiRequest('/inventory/reorder-rules?' + queryString({ page: 1, limit: 25, ...parameters }), {
      organizationId,
    }),
  createReorderRule: (organizationId, body) =>
    apiRequest('/inventory/reorder-rules', { organizationId, method: 'POST', body }),
  patchReorderRule: (organizationId, id, body) =>
    apiRequest('/inventory/reorder-rules/' + id, {
      organizationId,
      method: 'PATCH',
      body,
    }),

  listTransfers: (organizationId, parameters = {}) =>
    apiRequest('/inventory/transfers?' + queryString({ page: 1, limit: 25, ...parameters }), {
      organizationId,
    }),
  createTransfer: (organizationId, body) =>
    apiRequest('/inventory/transfers', { organizationId, method: 'POST', body }),
  getTransfer: (organizationId, id) =>
    apiRequest('/inventory/transfers/' + id, { organizationId }),
  patchTransfer: (organizationId, id, body) =>
    apiRequest('/inventory/transfers/' + id, { organizationId, method: 'PATCH', body }),
  shipTransfer: (organizationId, id) =>
    apiRequest('/inventory/transfers/' + id + '/ship', {
      organizationId,
      method: 'POST',
    }),
  receiveTransfer: (organizationId, id) =>
    apiRequest('/inventory/transfers/' + id + '/receive', {
      organizationId,
      method: 'POST',
    }),
  cancelTransfer: (organizationId, id) =>
    apiRequest('/inventory/transfers/' + id + '/cancel', {
      organizationId,
      method: 'POST',
    }),

  postGoodsReceipt: (organizationId, id) =>
    apiRequest('/goods-receipts/' + id + '/post-inventory', {
      organizationId,
      method: 'POST',
    }),
};
