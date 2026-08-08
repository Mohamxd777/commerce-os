import * as productService from '../services/productService.js';

export async function list(request, response) {
  const result = await productService.listProducts(
    request.organizationId,
    request.validated.query,
  );
  response.json({ data: result.items, meta: result.pagination });
}

export async function create(request, response) {
  const product = await productService.createProduct(
    request.organizationId,
    request.validated.body,
  );
  response.status(201).json({ data: product });
}

export async function get(request, response) {
  const product = await productService.getProduct(
    request.organizationId,
    request.validated.params.id,
  );
  response.json({ data: product });
}

export async function patch(request, response) {
  const product = await productService.patchProduct(
    request.organizationId,
    request.validated.params.id,
    request.validated.body,
  );
  response.json({ data: product });
}
