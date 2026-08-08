import { apiRequest, queryString } from './catalogApi.js';

export const researchApi = {
  listCandidates: (organizationId, parameters = {}) =>
    apiRequest('/research/candidates?' + queryString({ page: 1, limit: 25, ...parameters }), { organizationId }),
  createCandidate: (organizationId, body) =>
    apiRequest('/research/candidates', { organizationId, method: 'POST', body }),
  getCandidate: (organizationId, id) =>
    apiRequest('/research/candidates/' + id, { organizationId }),
  patchCandidate: (organizationId, id, body) =>
    apiRequest('/research/candidates/' + id, { organizationId, method: 'PATCH', body }),
  createSnapshot: (organizationId, id, body) =>
    apiRequest('/research/candidates/' + id + '/snapshots', { organizationId, method: 'POST', body }),
  createSupplierOption: (organizationId, id, body) =>
    apiRequest('/research/candidates/' + id + '/suppliers', { organizationId, method: 'POST', body }),
  patchSupplierOption: (organizationId, id, body) =>
    apiRequest('/research/supplier-options/' + id, { organizationId, method: 'PATCH', body }),
  createSample: (organizationId, id, body) =>
    apiRequest('/research/candidates/' + id + '/samples', { organizationId, method: 'POST', body }),
  patchSample: (organizationId, id, body) =>
    apiRequest('/research/samples/' + id, { organizationId, method: 'PATCH', body }),
  createFeeAssumption: (organizationId, id, body) =>
    apiRequest('/research/candidates/' + id + '/fee-assumptions', { organizationId, method: 'POST', body }),
  createEvidence: (organizationId, id, body) =>
    apiRequest('/research/candidates/' + id + '/evidence', { organizationId, method: 'POST', body }),
  calculateEconomics: (organizationId, id, body) =>
    apiRequest('/research/candidates/' + id + '/unit-economics', { organizationId, method: 'POST', body }),
  createEvaluation: (organizationId, id, body) =>
    apiRequest('/research/candidates/' + id + '/evaluations', { organizationId, method: 'POST', body }),
  compare: (organizationId, ids) =>
    apiRequest('/research/comparison?' + queryString({ ids: ids.join(',') }), { organizationId }),
  summary: (organizationId) => apiRequest('/research/summary', { organizationId }),
  settings: (organizationId) => apiRequest('/research/settings', { organizationId }),
  patchSettings: (organizationId, body) =>
    apiRequest('/research/settings', { organizationId, method: 'PATCH', body }),
  createProduct: (organizationId, id, body) =>
    apiRequest('/research/candidates/' + id + '/create-product', { organizationId, method: 'POST', body }),
};
