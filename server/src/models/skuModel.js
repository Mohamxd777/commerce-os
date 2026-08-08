import { updateCatalogRecord } from './catalogModelHelpers.js';

export async function listSkus(
  database,
  { organizationId, search, isActive, serialTrackingEnabled, productId, page, limit },
) {
  const searchPattern = search ? '%' + search + '%' : null;
  const offset = (page - 1) * limit;
  const parameters = [
    organizationId,
    searchPattern,
    isActive ?? null,
    serialTrackingEnabled ?? null,
    productId ?? null,
  ];
  const filters = `FROM skus AS sku
    JOIN product_variants AS variant
      ON variant.id = sku.product_variant_id
     AND variant.organization_id = sku.organization_id
    JOIN products AS product
      ON product.id = variant.product_id
     AND product.organization_id = variant.organization_id
    LEFT JOIN brands AS brand
      ON brand.id = product.brand_id
     AND brand.organization_id = product.organization_id
    LEFT JOIN sku_barcodes AS barcode
      ON barcode.sku_id = sku.id
     AND barcode.organization_id = sku.organization_id
     AND barcode.is_active = TRUE
    WHERE sku.organization_id = $1
      AND (
        $2::text IS NULL
        OR sku.sku_code ILIKE $2
        OR sku.manufacturer_part_number ILIKE $2
        OR product.name ILIKE $2
        OR product.model_number ILIKE $2
        OR brand.name ILIKE $2
      )
      AND ($3::boolean IS NULL OR sku.is_active = $3)
      AND ($4::boolean IS NULL OR sku.serial_tracking_enabled = $4)
      AND ($5::uuid IS NULL OR product.id = $5)`;

  const countResult = await database.query(
    'SELECT COUNT(DISTINCT sku.id)::int AS total ' + filters,
    parameters,
  );

  const result = await database.query(
    `SELECT sku.id, sku.organization_id, sku.product_variant_id, sku.sku_code,
            sku.manufacturer_part_number, sku.serial_tracking_enabled,
            sku.is_active, sku.created_at, sku.updated_at,
            variant.name AS variant_name, product.id AS product_id,
            product.name AS product_name, product.model_number,
            brand.name AS brand_name,
            COUNT(barcode.id)::int AS barcode_count
     ` +
      filters +
      `
      GROUP BY sku.id, variant.name, product.id, brand.name
      ORDER BY sku.updated_at DESC, sku.id
      LIMIT $6 OFFSET $7`,
    [...parameters, limit, offset],
  );

  return {
    rows: result.rows,
    total: countResult.rows[0].total,
  };
}

export async function findSkuById(database, { organizationId, id }) {
  const skuResult = await database.query(
    `SELECT sku.id, sku.organization_id, sku.product_variant_id, sku.sku_code,
            sku.manufacturer_part_number, sku.serial_tracking_enabled,
            sku.is_active, sku.created_at, sku.updated_at,
            variant.name AS variant_name, product.id AS product_id,
            product.name AS product_name, product.model_number,
            brand.name AS brand_name
     FROM skus AS sku
     JOIN product_variants AS variant
       ON variant.id = sku.product_variant_id
      AND variant.organization_id = sku.organization_id
     JOIN products AS product
       ON product.id = variant.product_id
      AND product.organization_id = variant.organization_id
     LEFT JOIN brands AS brand
       ON brand.id = product.brand_id
      AND brand.organization_id = product.organization_id
     WHERE sku.id = $1
       AND sku.organization_id = $2`,
    [id, organizationId],
  );

  if (skuResult.rowCount === 0) {
    return null;
  }

  const barcodeResult = await database.query(
    `SELECT id, identifier_type AS type, value, is_primary, is_active,
            created_at, updated_at
     FROM sku_barcodes
     WHERE sku_id = $1
       AND organization_id = $2
     ORDER BY is_primary DESC, created_at`,
    [id, organizationId],
  );

  return {
    ...skuResult.rows[0],
    barcodes: barcodeResult.rows,
  };
}

export async function findVariantById(database, { organizationId, id }) {
  const result = await database.query(
    `SELECT id, organization_id, product_id, name, is_active
     FROM product_variants
     WHERE id = $1 AND organization_id = $2`,
    [id, organizationId],
  );
  return result.rows[0] ?? null;
}

export async function createSku(
  database,
  { organizationId, productVariantId, skuCode, manufacturerPartNumber,
    serialTrackingEnabled, isActive },
) {
  const result = await database.query(
    `INSERT INTO skus (
       organization_id, product_variant_id, sku_code,
       manufacturer_part_number, serial_tracking_enabled, is_active
     )
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      organizationId,
      productVariantId,
      skuCode,
      manufacturerPartNumber ?? null,
      serialTrackingEnabled,
      isActive,
    ],
  );
  return result.rows[0];
}

export async function createBarcodes(database, { organizationId, skuId, barcodes }) {
  const created = [];

  for (const barcode of barcodes) {
    const result = await database.query(
      `INSERT INTO sku_barcodes (
         organization_id, sku_id, identifier_type, value, is_primary, is_active
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, identifier_type AS type, value, is_primary, is_active,
                 created_at, updated_at`,
      [
        organizationId,
        skuId,
        barcode.type,
        barcode.value,
        barcode.isPrimary,
        barcode.isActive,
      ],
    );
    created.push(result.rows[0]);
  }

  return created;
}

export async function replaceBarcodes(database, { organizationId, skuId, barcodes }) {
  await database.query(
    'DELETE FROM sku_barcodes WHERE sku_id = $1 AND organization_id = $2',
    [skuId, organizationId],
  );
  return createBarcodes(database, { organizationId, skuId, barcodes });
}

export function updateSku(database, { organizationId, id, changes }) {
  return updateCatalogRecord(database, {
    table: 'skus',
    organizationId,
    id,
    changes,
  });
}
