import { pool } from '../config/database.js';
import { paginationMetadata } from '../models/catalogModelHelpers.js';
import * as locationModel from '../models/locationModel.js';
import { translatePurchasingError } from './purchasingErrors.js';

export async function listLocations(organizationId, query) {
  const result = await locationModel.listLocations(pool, { organizationId, ...query });
  return {
    items: result.rows,
    pagination: paginationMetadata(result.total, query.page, query.limit),
  };
}

export async function createLocation(organizationId, input) {
  try {
    return await locationModel.createLocation(pool, { organizationId, ...input });
  } catch (error) {
    throw translatePurchasingError(error);
  }
}
