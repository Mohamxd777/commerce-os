export async function apiRequest(path, { organizationId, method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch('/api' + path, {
      method,
      credentials: 'include',
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(organizationId ? { 'x-organization-id': organizationId } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    const error = new Error('The server could not be reached.');
    error.code = 'NETWORK_ERROR';
    throw error;
  }

  if (response.status === 204) return null;

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  let responseBody;
  try {
    responseBody = await response.text();
  } catch {
    const error = new Error('The response body could not be read.');
    error.code = 'RESPONSE_BODY_READ_FAILED';
    error.status = response.status;
    throw error;
  }

  if (!responseBody.trim()) {
    const error = new Error('The server returned an empty response.');
    error.code = 'EMPTY_RESPONSE';
    error.status = response.status;
    error.details = { responseContentType: contentType || null };
    throw error;
  }

  if (!contentType.includes('application/json') && !contentType.includes('+json')) {
    const error = new Error('The server returned a non-JSON response.');
    error.code = 'NON_JSON_RESPONSE';
    error.status = response.status;
    error.details = { responseContentType: contentType || null };
    throw error;
  }

  let payload;
  try {
    payload = JSON.parse(responseBody);
  } catch {
    const error = new Error('The server returned malformed JSON.');
    error.code = 'MALFORMED_JSON_RESPONSE';
    error.status = response.status;
    error.details = { responseContentType: contentType || null };
    throw error;
  }

  if (!response.ok) {
    const error = new Error(payload.error?.message || 'The request failed.');
    error.code = payload.error?.code;
    error.status = response.status;
    error.details = payload.error?.details;
    throw error;
  }

  return payload;
}

export function queryString(parameters) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(parameters)) {
    if (value !== '' && value !== undefined && value !== null) {
      query.set(key, value);
    }
  }
  return query.toString();
}

export const authApi = {
  me: () => apiRequest('/auth/me'),
  login: (credentials) => apiRequest('/auth/login', { method: 'POST', body: credentials }),
};

export const catalogApi = {
  listBrands: (organizationId, parameters = {}) =>
    apiRequest('/brands?' + queryString({ page: 1, limit: 100, ...parameters }), {
      organizationId,
    }),
  createBrand: (organizationId, body) =>
    apiRequest('/brands', { organizationId, method: 'POST', body }),
  patchBrand: (organizationId, id, body) =>
    apiRequest('/brands/' + id, { organizationId, method: 'PATCH', body }),

  listCategories: (organizationId, parameters = {}) =>
    apiRequest('/categories?' + queryString({ page: 1, limit: 100, ...parameters }), {
      organizationId,
    }),
  createCategory: (organizationId, body) =>
    apiRequest('/categories', { organizationId, method: 'POST', body }),
  patchCategory: (organizationId, id, body) =>
    apiRequest('/categories/' + id, { organizationId, method: 'PATCH', body }),

  listProducts: (organizationId, parameters = {}) =>
    apiRequest('/products?' + queryString({ page: 1, limit: 25, ...parameters }), {
      organizationId,
    }),
  getProduct: (organizationId, id) =>
    apiRequest('/products/' + id, { organizationId }),
  createProduct: (organizationId, body) =>
    apiRequest('/products', { organizationId, method: 'POST', body }),
  patchProduct: (organizationId, id, body) =>
    apiRequest('/products/' + id, { organizationId, method: 'PATCH', body }),

  listSkus: (organizationId, parameters = {}) =>
    apiRequest('/skus?' + queryString({ page: 1, limit: 25, ...parameters }), {
      organizationId,
    }),
  patchSku: (organizationId, id, body) =>
    apiRequest('/skus/' + id, { organizationId, method: 'PATCH', body }),
};
