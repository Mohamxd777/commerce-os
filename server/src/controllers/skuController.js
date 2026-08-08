import * as skuService from '../services/skuService.js';

export async function list(request, response) {
  const result = await skuService.listSkus(
    request.organizationId,
    request.validated.query,
  );
  response.json({ data: result.items, meta: result.pagination });
}

export async function create(request, response) {
  const sku = await skuService.createSku(
    request.organizationId,
    request.validated.body,
  );
  response.status(201).json({ data: sku });
}

export async function get(request, response) {
  const sku = await skuService.getSku(
    request.organizationId,
    request.validated.params.id,
  );
  response.json({ data: sku });
}

export async function patch(request, response) {
  const sku = await skuService.patchSku(
    request.organizationId,
    request.validated.params.id,
    request.validated.body,
  );
  response.json({ data: sku });
}
