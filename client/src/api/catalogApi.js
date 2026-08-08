async function apiRequest(path, { organizationId, method = 'GET', body } = {}) {
  const response = await fetch('/api' + path, {
    method,
    credentials: 'include',
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(organizationId ? { 'x-organization-id': organizationId } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) return null;

  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload.error?.message || 'The request failed.');
    error.code = payload.error?.code;
    error.status = response.status;
    error.details = payload.error?.details;
    throw error;
  }

  return payload;
}

function queryString(parameters) {
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
