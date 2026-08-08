import * as inventoryService from '../services/inventoryService.js';

export async function list(request, response) {
  const result = await inventoryService.listInventory(
    request.organizationId,
    request.validated.query,
  );
  response.json({ data: result.items, meta: result.pagination });
}

export async function summary(request, response) {
  const result = await inventoryService.getInventorySummary(request.organizationId);
  response.json({ data: result });
}

export async function movements(request, response) {
  const result = await inventoryService.listInventoryMovements(
    request.organizationId,
    request.validated.query,
  );
  response.json({ data: result.items, meta: result.pagination });
}

export async function skuInventory(request, response) {
  const result = await inventoryService.getSkuInventory(
    request.organizationId,
    request.validated.params.id,
  );
  response.json({ data: result });
}

export async function adjust(request, response) {
  const result = await inventoryService.createAdjustment(
    request.organizationId,
    request.user.id,
    request.validated.body,
  );
  response.status(201).json({ data: result });
}

export async function reconcile(request, response) {
  const result = await inventoryService.reconcileInventory(request.organizationId);
  response.json({ data: result });
}

export async function listReorderRules(request, response) {
  const result = await inventoryService.listReorderRules(
    request.organizationId,
    request.validated.query,
  );
  response.json({ data: result.items, meta: result.pagination });
}

export async function createReorderRule(request, response) {
  const result = await inventoryService.createReorderRule(
    request.organizationId,
    request.validated.body,
  );
  response.status(201).json({ data: result });
}

export async function patchReorderRule(request, response) {
  const result = await inventoryService.patchReorderRule(
    request.organizationId,
    request.validated.params.id,
    request.validated.body,
  );
  response.json({ data: result });
}

export async function listTransfers(request, response) {
  const result = await inventoryService.listTransfers(
    request.organizationId,
    request.validated.query,
  );
  response.json({ data: result.items, meta: result.pagination });
}

export async function createTransfer(request, response) {
  const result = await inventoryService.createTransfer(
    request.organizationId,
    request.user.id,
    request.validated.body,
  );
  response.status(201).json({ data: result });
}

export async function getTransfer(request, response) {
  const result = await inventoryService.getTransfer(
    request.organizationId,
    request.validated.params.id,
  );
  response.json({ data: result });
}

export async function patchTransfer(request, response) {
  const result = await inventoryService.patchTransfer(
    request.organizationId,
    request.validated.params.id,
    request.validated.body,
  );
  response.json({ data: result });
}

export async function shipTransfer(request, response) {
  const result = await inventoryService.shipTransfer(
    request.organizationId,
    request.validated.params.id,
    request.user.id,
  );
  response.json({ data: result });
}

export async function receiveTransfer(request, response) {
  const result = await inventoryService.receiveTransfer(
    request.organizationId,
    request.validated.params.id,
    request.user.id,
  );
  response.json({ data: result });
}

export async function cancelTransfer(request, response) {
  const result = await inventoryService.cancelTransfer(
    request.organizationId,
    request.validated.params.id,
  );
  response.json({ data: result });
}

export async function postGoodsReceipt(request, response) {
  const result = await inventoryService.postGoodsReceiptInventory(
    request.organizationId,
    request.validated.params.id,
    request.user.id,
  );
  response.json({ data: result });
}
