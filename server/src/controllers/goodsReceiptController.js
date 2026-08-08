import * as goodsReceiptService from '../services/goodsReceiptService.js';

export async function list(request, response) {
  const result = await goodsReceiptService.listGoodsReceipts(
    request.organizationId,
    request.validated.query,
  );
  response.json({ data: result.items, meta: result.pagination });
}

export async function get(request, response) {
  const receipt = await goodsReceiptService.getGoodsReceipt(
    request.organizationId,
    request.validated.params.id,
  );
  response.json({ data: receipt });
}

export async function create(request, response) {
  const receipt = await goodsReceiptService.createGoodsReceipt(
    request.organizationId,
    request.validated.params.id,
    request.user.id,
    request.validated.body,
  );
  response.status(201).json({ data: receipt });
}
