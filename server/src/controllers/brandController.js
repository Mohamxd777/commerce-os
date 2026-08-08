import * as brandService from '../services/brandService.js';

export async function list(request, response) {
  const result = await brandService.listBrands(
    request.organizationId,
    request.validated.query,
  );
  response.json({ data: result.items, meta: result.pagination });
}

export async function create(request, response) {
  const brand = await brandService.createBrand(
    request.organizationId,
    request.validated.body,
  );
  response.status(201).json({ data: brand });
}

export async function get(request, response) {
  const brand = await brandService.getBrand(
    request.organizationId,
    request.validated.params.id,
  );
  response.json({ data: brand });
}

export async function patch(request, response) {
  const brand = await brandService.patchBrand(
    request.organizationId,
    request.validated.params.id,
    request.validated.body,
  );
  response.json({ data: brand });
}
