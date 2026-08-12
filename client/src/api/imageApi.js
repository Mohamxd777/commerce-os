import { apiRequest, queryString } from './catalogApi.js';

async function rawRequest(path, organizationId, file, entityType, entityId, isPrimary = false) {
  const response = await fetch('/api' + path, {
    method: 'POST', credentials: 'include',
    headers: {
      'Content-Type': file.type,
      'x-organization-id': organizationId,
      'x-file-name': encodeURIComponent(file.name),
      'x-image-entity-type': entityType,
      'x-image-entity-id': entityId,
      'x-image-primary': String(isPrimary),
    },
    body: file,
  });
  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload.error?.message || 'The image upload failed.');
    error.code = payload.error?.code;
    throw error;
  }
  return payload;
}

export const imageApi = {
  upload: (organizationId, file, entityType, entityId, isPrimary) =>
    rawRequest('/images/upload', organizationId, file, entityType, entityId, isPrimary),
  importNoon: (organizationId, body) =>
    apiRequest('/images/import-noon', { organizationId, method: 'POST', body }),
  list: (organizationId, entityType, entityId) =>
    apiRequest('/images?' + queryString({ entityType, entityId }), { organizationId }),
  setPrimary: (organizationId, id, body) =>
    apiRequest('/images/' + id + '/primary', { organizationId, method: 'PATCH', body }),
  remove: (organizationId, id, entityType, entityId) =>
    apiRequest('/images/' + id + '?' + queryString({ entityType, entityId }), { organizationId, method: 'DELETE' }),
  contentUrl: (id, organizationId) => '/api/images/' + id + '/content?' + queryString({ organizationId }),
};
