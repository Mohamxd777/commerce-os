import { apiRequest, queryString } from './catalogApi.js';

const transportFailureCodes = new Set([
  'NETWORK_ERROR', 'EMPTY_RESPONSE', 'NON_JSON_RESPONSE', 'MALFORMED_JSON_RESPONSE',
  'RESPONSE_BODY_READ_FAILED',
]);

export function noonAnalyzerErrorMessage(error) {
  if (transportFailureCodes.has(error?.code)) return 'Noon could not be reached. Try again.';
  const reason = error?.details?.reason;
  if (reason === 'blocked') return 'The analyzer was blocked by Noon.';
  if (['timeout', 'unreachable', 'upstream_error'].includes(reason)) {
    return 'Noon could not be reached. Try again.';
  }
  return 'This Noon page could not be analyzed.';
}

export const researchApi = {
  listCandidates: (organizationId, parameters = {}) =>
    apiRequest('/research/candidates?' + queryString({ page: 1, limit: 25, ...parameters }), { organizationId }),
  createCandidate: (organizationId, body) =>
    apiRequest('/research/candidates', { organizationId, method: 'POST', body }),
  quickCapture: (organizationId, body) =>
    apiRequest('/research/quick-capture', { organizationId, method: 'POST', body }),
  getCandidate: (organizationId, id) =>
    apiRequest('/research/candidates/' + id, { organizationId }),
  patchCandidate: (organizationId, id, body) =>
    apiRequest('/research/candidates/' + id, { organizationId, method: 'PATCH', body }),
  analyzeNoon: (organizationId, url) =>
    apiRequest('/research/noon/analyze', { organizationId, method: 'POST', body: { url } }),
  createSnapshot: (organizationId, id, body) =>
    apiRequest('/research/candidates/' + id + '/snapshots', { organizationId, method: 'POST', body }),
  createSupplierOption: (organizationId, id, body) =>
    apiRequest('/research/candidates/' + id + '/suppliers', { organizationId, method: 'POST', body }),
  patchSupplierOption: (organizationId, id, body) =>
    apiRequest('/research/supplier-options/' + id, { organizationId, method: 'PATCH', body }),
  promoteSupplierOption: (organizationId, id, body) =>
    apiRequest('/research/supplier-options/' + id + '/promote', { organizationId, method: 'POST', body }),
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
