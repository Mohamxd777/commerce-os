import * as supplierService from '../services/supplierService.js';

export async function list(request, response) {
  const result = await supplierService.listSuppliers(
    request.organizationId,
    request.validated.query,
  );
  response.json({ data: result.items, meta: result.pagination });
}

export async function create(request, response) {
  const supplier = await supplierService.createSupplier(
    request.organizationId,
    request.validated.body,
  );
  response.status(201).json({ data: supplier });
}

export async function get(request, response) {
  const supplier = await supplierService.getSupplier(
    request.organizationId,
    request.validated.params.id,
  );
  response.json({ data: supplier });
}

export async function patch(request, response) {
  const supplier = await supplierService.patchSupplier(
    request.organizationId,
    request.validated.params.id,
    request.validated.body,
  );
  response.json({ data: supplier });
}
