import * as supplierProductService from '../services/supplierProductService.js';

export async function list(request, response) {
  const result = await supplierProductService.listSupplierProducts(
    request.organizationId,
    request.validated.query,
  );
  response.json({ data: result.items, meta: result.pagination });
}

export async function create(request, response) {
  const supplierProduct = await supplierProductService.createSupplierProduct(
    request.organizationId,
    request.validated.body,
  );
  response.status(201).json({ data: supplierProduct });
}

export async function get(request, response) {
  const supplierProduct = await supplierProductService.getSupplierProduct(
    request.organizationId,
    request.validated.params.id,
  );
  response.json({ data: supplierProduct });
}

export async function patch(request, response) {
  const supplierProduct = await supplierProductService.patchSupplierProduct(
    request.organizationId,
    request.validated.params.id,
    request.validated.body,
  );
  response.json({ data: supplierProduct });
}

export async function updatePrice(request, response) {
  const supplierProduct = await supplierProductService.updateSupplierPrice(
    request.organizationId,
    request.validated.params.id,
    request.validated.body,
  );
  response.json({ data: supplierProduct });
}

export async function compareSkuSuppliers(request, response) {
  const result = await supplierProductService.compareSkuSuppliers(
    request.organizationId,
    request.validated.params.id,
    request.validated.query,
  );
  response.json({
    data: result.items,
    meta: { ...result.pagination, sku: result.sku },
  });
}
