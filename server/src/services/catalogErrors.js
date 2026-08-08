import { AppError } from '../utils/AppError.js';

const duplicateErrors = {
  brands_organization_id_normalized_name_key: [
    'DUPLICATE_BRAND',
    'A brand with this name already exists in the organization.',
  ],
  categories_root_name_unique: [
    'DUPLICATE_CATEGORY',
    'A root category with this name already exists.',
  ],
  categories_child_name_unique: [
    'DUPLICATE_CATEGORY',
    'A category with this name already exists under the selected parent.',
  ],
  product_variants_name_unique: [
    'DUPLICATE_VARIANT',
    'Variant names must be unique within a product.',
  ],
  skus_organization_code_unique: [
    'DUPLICATE_SKU',
    'This SKU code already exists in the organization.',
  ],
  sku_barcodes_organization_identifier_unique: [
    'DUPLICATE_BARCODE',
    'This barcode identifier already exists in the organization.',
  ],
  sku_barcodes_one_primary: [
    'MULTIPLE_PRIMARY_BARCODES',
    'A SKU may have only one active primary barcode.',
  ],
};

export function translateCatalogError(error) {
  if (error instanceof AppError) {
    return error;
  }

  if (error.code === '23505') {
    const mapped = duplicateErrors[error.constraint] ?? [
      'DUPLICATE_CATALOG_RECORD',
      'A catalog record with these details already exists.',
    ];
    return new AppError(409, mapped[0], mapped[1]);
  }

  if (error.code === '23503') {
    return new AppError(
      400,
      'INVALID_CATALOG_REFERENCE',
      'The referenced catalog record does not exist in this organization.',
    );
  }

  if (error.code === '23514' && error.message?.includes('CATEGORY_CYCLE')) {
    return new AppError(
      400,
      'CATEGORY_CYCLE',
      'A category cannot be its own ancestor or descendant.',
    );
  }

  if (error.code === '23514' || error.code === '22P02') {
    return new AppError(
      400,
      'CATALOG_CONSTRAINT_VIOLATION',
      'The catalog data violates a required format or relationship.',
    );
  }

  return error;
}
