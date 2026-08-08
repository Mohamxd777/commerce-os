import { updateCatalogRecord } from './catalogModelHelpers.js';

function productFilterSql() {
  return `FROM products AS product
    LEFT JOIN brands AS brand
      ON brand.id = product.brand_id
     AND brand.organization_id = product.organization_id
    JOIN categories AS category
      ON category.id = product.category_id
     AND category.organization_id = product.organization_id
    LEFT JOIN product_variants AS variant
      ON variant.product_id = product.id
     AND variant.organization_id = product.organization_id
    LEFT JOIN skus AS sku
      ON sku.product_variant_id = variant.id
     AND sku.organization_id = variant.organization_id
    WHERE product.organization_id = $1
      AND (
        $2::text IS NULL
        OR product.name ILIKE $2
        OR product.model_number ILIKE $2
        OR brand.name ILIKE $2
        OR EXISTS (
          SELECT 1
          FROM product_variants AS variant
          JOIN skus AS sku
            ON sku.product_variant_id = variant.id
           AND sku.organization_id = variant.organization_id
          WHERE variant.product_id = product.id
            AND variant.organization_id = product.organization_id
            AND sku.sku_code ILIKE $2
        )
      )
      AND ($3::uuid IS NULL OR product.category_id = $3)
      AND ($4::uuid IS NULL OR product.brand_id = $4)
      AND ($5::text IS NULL OR product.status = $5)`;
}

export async function listProducts(
  database,
  { organizationId, search, categoryId, brandId, status, page, limit },
) {
  const searchPattern = search ? '%' + search + '%' : null;
  const offset = (page - 1) * limit;
  const parameters = [
    organizationId,
    searchPattern,
    categoryId ?? null,
    brandId ?? null,
    status ?? null,
  ];
  const filters = productFilterSql();

  const countResult = await database.query(
    'SELECT COUNT(DISTINCT product.id)::int AS total ' + filters,
    parameters,
  );

  const result = await database.query(
    `SELECT product.id, product.organization_id, product.brand_id,
            product.category_id, product.name, product.model_number,
            product.description, product.warranty_months,
            product.default_weight_grams, product.default_length_mm,
            product.default_width_mm, product.default_height_mm,
            product.notes, product.status, product.archived_at,
            product.created_at, product.updated_at,
            brand.name AS brand_name, category.name AS category_name,
            COUNT(DISTINCT variant.id)::int AS variant_count,
            COUNT(DISTINCT sku.id)::int AS sku_count
     ` +
      filters +
      `
      GROUP BY product.id, brand.name, category.name
      ORDER BY product.updated_at DESC, product.id
      LIMIT $6 OFFSET $7`,
    [...parameters, limit, offset],
  );

  return {
    rows: result.rows,
    total: countResult.rows[0].total,
  };
}

export async function findProductById(database, { organizationId, id }) {
  const result = await database.query(
    `SELECT product.id, product.organization_id, product.brand_id,
            product.category_id, product.name, product.model_number,
            product.description, product.warranty_months,
            product.default_weight_grams, product.default_length_mm,
            product.default_width_mm, product.default_height_mm,
            product.notes, product.status, product.archived_at,
            product.created_at, product.updated_at,
            brand.name AS brand_name, category.name AS category_name
     FROM products AS product
     LEFT JOIN brands AS brand
       ON brand.id = product.brand_id
      AND brand.organization_id = product.organization_id
     JOIN categories AS category
       ON category.id = product.category_id
      AND category.organization_id = product.organization_id
     WHERE product.id = $1
       AND product.organization_id = $2`,
    [id, organizationId],
  );
  return result.rows[0] ?? null;
}

export async function listProductVariants(database, { organizationId, productId }) {
  const result = await database.query(
    `SELECT id, organization_id, product_id, name, attributes, weight_grams,
            length_mm, width_mm, height_mm, is_active, created_at, updated_at
     FROM product_variants
     WHERE product_id = $1
       AND organization_id = $2
     ORDER BY created_at, id`,
    [productId, organizationId],
  );
  return result.rows;
}

export async function listProductSkus(database, { organizationId, productId }) {
  const result = await database.query(
    `SELECT sku.id, sku.organization_id, sku.product_variant_id, sku.sku_code,
            sku.manufacturer_part_number, sku.serial_tracking_enabled,
            sku.is_active, sku.created_at, sku.updated_at,
            COALESCE(
              jsonb_agg(
                jsonb_build_object(
                  'id', barcode.id,
                  'type', barcode.identifier_type,
                  'value', barcode.value,
                  'isPrimary', barcode.is_primary,
                  'isActive', barcode.is_active
                )
                ORDER BY barcode.is_primary DESC, barcode.created_at
              ) FILTER (WHERE barcode.id IS NOT NULL),
              '[]'::jsonb
            ) AS barcodes
     FROM skus AS sku
     JOIN product_variants AS variant
       ON variant.id = sku.product_variant_id
      AND variant.organization_id = sku.organization_id
     LEFT JOIN sku_barcodes AS barcode
       ON barcode.sku_id = sku.id
      AND barcode.organization_id = sku.organization_id
     WHERE variant.product_id = $1
       AND sku.organization_id = $2
     GROUP BY sku.id
     ORDER BY sku.created_at, sku.id`,
    [productId, organizationId],
  );
  return result.rows;
}

export async function listProductImages(database, { organizationId, productId }) {
  const result = await database.query(
    `SELECT id, storage_key, original_filename, media_type, alt_text,
            sort_order, is_primary, is_active, created_at, updated_at
     FROM product_images
     WHERE product_id = $1
       AND organization_id = $2
       AND is_active = TRUE
     ORDER BY is_primary DESC, sort_order, created_at`,
    [productId, organizationId],
  );
  return result.rows;
}

export async function createProduct(database, product) {
  const result = await database.query(
    `INSERT INTO products (
       organization_id, brand_id, category_id, name, model_number,
       description, warranty_months, default_weight_grams, default_length_mm,
       default_width_mm, default_height_mm, notes, status, archived_at
     )
     VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::varchar,
       CASE WHEN $13::varchar = 'archived'::varchar THEN NOW() ELSE NULL END
     )
     RETURNING *`,
    [
      product.organizationId,
      product.brandId ?? null,
      product.categoryId,
      product.name,
      product.modelNumber ?? null,
      product.description ?? null,
      product.warrantyMonths ?? null,
      product.defaultWeightGrams ?? null,
      product.defaultLengthMm ?? null,
      product.defaultWidthMm ?? null,
      product.defaultHeightMm ?? null,
      product.notes ?? null,
      product.status,
    ],
  );
  return result.rows[0];
}

export async function createVariant(database, { organizationId, productId, variant }) {
  const result = await database.query(
    `INSERT INTO product_variants (
       organization_id, product_id, name, attributes, weight_grams,
       length_mm, width_mm, height_mm, is_active
     )
     VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      organizationId,
      productId,
      variant.name,
      JSON.stringify(variant.attributes),
      variant.weightGrams ?? null,
      variant.lengthMm ?? null,
      variant.widthMm ?? null,
      variant.heightMm ?? null,
      variant.isActive,
    ],
  );
  return result.rows[0];
}

export function updateProduct(database, { organizationId, id, changes }) {
  return updateCatalogRecord(database, {
    table: 'products',
    organizationId,
    id,
    changes,
  });
}
