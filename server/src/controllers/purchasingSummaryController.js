import * as purchasingSummaryService from '../services/purchasingSummaryService.js';

export async function get(request, response) {
  const summary = await purchasingSummaryService.getPurchasingSummary(
    request.organizationId,
    request.validated.query,
  );
  response.json({ data: summary });
}
