import { pool } from '../config/database.js';
import * as brandModel from '../models/brandModel.js';
import { paginationMetadata } from '../models/catalogModelHelpers.js';
import { AppError } from '../utils/AppError.js';
import { translateCatalogError } from './catalogErrors.js';

export async function listBrands(organizationId, query) {
  const result = await brandModel.listBrands(pool, {
    organizationId,
    ...query,
  });
  return {
    items: result.rows,
    pagination: paginationMetadata(result.total, query.page, query.limit),
  };
}

export async function getBrand(organizationId, id) {
  const brand = await brandModel.findBrandById(pool, { organizationId, id });
  if (!brand) {
    throw new AppError(404, 'BRAND_NOT_FOUND', 'Brand not found.');
  }
  return brand;
}

export async function createBrand(organizationId, input) {
  try {
    return await brandModel.createBrand(pool, { organizationId, ...input });
  } catch (error) {
    throw translateCatalogError(error);
  }
}

export async function patchBrand(organizationId, id, input) {
  const changes = {};
  if (input.name !== undefined) changes.name = input.name;
  if (input.websiteUrl !== undefined) changes.website_url = input.websiteUrl;
  if (input.notes !== undefined) changes.notes = input.notes;
  if (input.isActive !== undefined) changes.is_active = input.isActive;

  try {
    const brand = await brandModel.updateBrand(pool, {
      organizationId,
      id,
      changes,
    });
    if (!brand) {
      throw new AppError(404, 'BRAND_NOT_FOUND', 'Brand not found.');
    }
    return brand;
  } catch (error) {
    throw translateCatalogError(error);
  }
}
