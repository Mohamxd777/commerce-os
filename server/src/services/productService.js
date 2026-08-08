import { pool } from '../config/database.js';
import * as brandModel from '../models/brandModel.js';
import { paginationMetadata } from '../models/catalogModelHelpers.js';
import * as categoryModel from '../models/categoryModel.js';
import * as productModel from '../models/productModel.js';
import * as skuModel from '../models/skuModel.js';
import { AppError } from '../utils/AppError.js';
import { translateCatalogError } from './catalogErrors.js';
import { validateProductIdentifiers } from './catalogInputRules.js';

async function ensureReferences(database, organizationId, { brandId, categoryId }) {
  const category = await categoryModel.findCategoryById(database, {
    organizationId,
    id: categoryId,
  });
  if (!category) {
    throw new AppError(
      400,
      'CATEGORY_NOT_FOUND',
      'The selected category does not exist in this organization.',
    );
  }

  if (brandId) {
    const brand = await brandModel.findBrandById(database, {
      organizationId,
      id: brandId,
    });
    if (!brand) {
      throw new AppError(
        400,
        'BRAND_NOT_FOUND',
        'The selected brand does not exist in this organization.',
      );
    }
  }
}

export async function listProducts(organizationId, query) {
  const result = await productModel.listProducts(pool, {
    organizationId,
    ...query,
  });
  return {
    items: result.rows,
    pagination: paginationMetadata(result.total, query.page, query.limit),
  };
}

export async function getProduct(organizationId, id) {
  const product = await productModel.findProductById(pool, { organizationId, id });
  if (!product) {
    throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');
  }

  const [variants, skus, images] = await Promise.all([
    productModel.listProductVariants(pool, { organizationId, productId: id }),
    productModel.listProductSkus(pool, { organizationId, productId: id }),
    productModel.listProductImages(pool, { organizationId, productId: id }),
  ]);
  const variantsById = new Map(
    variants.map((variant) => [variant.id, { ...variant, skus: [] }]),
  );

  for (const sku of skus) {
    variantsById.get(sku.product_variant_id)?.skus.push(sku);
  }

  return {
    ...product,
    variants: [...variantsById.values()],
    images,
  };
}

export async function createProduct(organizationId, input) {
  validateProductIdentifiers(input.variants);
  const database = await pool.connect();

  try {
    await database.query('BEGIN');
    await ensureReferences(database, organizationId, input);

    const product = await productModel.createProduct(database, {
      organizationId,
      ...input,
    });

    for (const variantInput of input.variants) {
      const variant = await productModel.createVariant(database, {
        organizationId,
        productId: product.id,
        variant: variantInput,
      });

      for (const skuInput of variantInput.skus) {
        const sku = await skuModel.createSku(database, {
          organizationId,
          productVariantId: variant.id,
          ...skuInput,
        });
        await skuModel.createBarcodes(database, {
          organizationId,
          skuId: sku.id,
          barcodes: skuInput.barcodes,
        });
      }
    }

    await database.query('COMMIT');
    return getProduct(organizationId, product.id);
  } catch (error) {
    await database.query('ROLLBACK');
    throw translateCatalogError(error);
  } finally {
    database.release();
  }
}

export async function patchProduct(organizationId, id, input) {
  const existing = await productModel.findProductById(pool, { organizationId, id });
  if (!existing) {
    throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');
  }

  await ensureReferences(pool, organizationId, {
    brandId: input.brandId !== undefined ? input.brandId : existing.brand_id,
    categoryId: input.categoryId ?? existing.category_id,
  });

  const changes = {};
  const fieldMap = {
    brandId: 'brand_id',
    categoryId: 'category_id',
    name: 'name',
    modelNumber: 'model_number',
    description: 'description',
    warrantyMonths: 'warranty_months',
    defaultWeightGrams: 'default_weight_grams',
    defaultLengthMm: 'default_length_mm',
    defaultWidthMm: 'default_width_mm',
    defaultHeightMm: 'default_height_mm',
    notes: 'notes',
    status: 'status',
  };

  for (const [inputField, column] of Object.entries(fieldMap)) {
    if (input[inputField] !== undefined) {
      changes[column] = input[inputField];
    }
  }

  if (input.status !== undefined) {
    changes.archived_at = input.status === 'archived' ? new Date() : null;
  }

  try {
    await productModel.updateProduct(pool, { organizationId, id, changes });
    return getProduct(organizationId, id);
  } catch (error) {
    throw translateCatalogError(error);
  }
}
