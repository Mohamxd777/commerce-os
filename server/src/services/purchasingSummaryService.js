import { pool } from '../config/database.js';
import * as purchasingSummaryModel from '../models/purchasingSummaryModel.js';

export function getPurchasingSummary(organizationId, query) {
  return purchasingSummaryModel.getPurchasingSummary(pool, {
    organizationId,
    ...query,
  });
}
