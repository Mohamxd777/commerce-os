import * as purchaseOrderService from '../services/purchaseOrderService.js';

export async function list(request, response) {
  const result = await purchaseOrderService.listPurchaseOrders(
    request.organizationId,
    request.validated.query,
  );
  response.json({ data: result.items, meta: result.pagination });
}

export async function create(request, response) {
  const purchaseOrder = await purchaseOrderService.createPurchaseOrder(
    request.organizationId,
    request.user.id,
    request.validated.body,
  );
  response.status(201).json({ data: purchaseOrder });
}

export async function get(request, response) {
  const purchaseOrder = await purchaseOrderService.getPurchaseOrder(
    request.organizationId,
    request.validated.params.id,
  );
  response.json({ data: purchaseOrder });
}

export async function patch(request, response) {
  const purchaseOrder = await purchaseOrderService.patchPurchaseOrder(
    request.organizationId,
    request.validated.params.id,
    request.validated.body,
  );
  response.json({ data: purchaseOrder });
}

export async function approve(request, response) {
  const purchaseOrder = await purchaseOrderService.approvePurchaseOrder(
    request.organizationId,
    request.validated.params.id,
    request.user.id,
  );
  response.json({ data: purchaseOrder });
}

export async function markOrdered(request, response) {
  const purchaseOrder = await purchaseOrderService.markPurchaseOrderOrdered(
    request.organizationId,
    request.validated.params.id,
  );
  response.json({ data: purchaseOrder });
}

export async function cancel(request, response) {
  const purchaseOrder = await purchaseOrderService.cancelPurchaseOrder(
    request.organizationId,
    request.validated.params.id,
  );
  response.json({ data: purchaseOrder });
}
