import { pool } from '../config/database.js';
import * as categoryModel from '../models/categoryModel.js';
import { paginationMetadata } from '../models/catalogModelHelpers.js';
import { AppError } from '../utils/AppError.js';
import { translateCatalogError } from './catalogErrors.js';

async function ensureParent(organizationId, parentId) {
  if (!parentId) return;

  const parent = await categoryModel.findCategoryById(pool, {
    organizationId,
    id: parentId,
  });
  if (!parent) {
    throw new AppError(
      400,
      'CATEGORY_PARENT_NOT_FOUND',
      'The parent category does not exist in this organization.',
    );
  }
}

export async function listCategories(organizationId, query) {
  const result = await categoryModel.listCategories(pool, {
    organizationId,
    ...query,
  });
  return {
    items: result.rows,
    pagination: paginationMetadata(result.total, query.page, query.limit),
  };
}

export async function getCategory(organizationId, id) {
  const category = await categoryModel.findCategoryById(pool, { organizationId, id });
  if (!category) {
    throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Category not found.');
  }
  return category;
}

export async function createCategory(organizationId, input) {
  await ensureParent(organizationId, input.parentId);

  try {
    return await categoryModel.createCategory(pool, {
      organizationId,
      ...input,
    });
  } catch (error) {
    throw translateCatalogError(error);
  }
}

export async function patchCategory(organizationId, id, input) {
  const existing = await categoryModel.findCategoryById(pool, { organizationId, id });
  if (!existing) {
    throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Category not found.');
  }

  if (input.parentId !== undefined && input.parentId !== null) {
    await ensureParent(organizationId, input.parentId);
    const createsCycle = await categoryModel.wouldCreateCategoryCycle(pool, {
      organizationId,
      categoryId: id,
      proposedParentId: input.parentId,
    });
    if (createsCycle) {
      throw new AppError(
        400,
        'CATEGORY_CYCLE',
        'A category cannot be its own ancestor or descendant.',
      );
    }
  }

  const changes = {};
  if (input.parentId !== undefined) changes.parent_id = input.parentId;
  if (input.name !== undefined) changes.name = input.name;
  if (input.description !== undefined) changes.description = input.description;
  if (input.isActive !== undefined) changes.is_active = input.isActive;

  try {
    return await categoryModel.updateCategory(pool, {
      organizationId,
      id,
      changes,
    });
  } catch (error) {
    throw translateCatalogError(error);
  }
}
