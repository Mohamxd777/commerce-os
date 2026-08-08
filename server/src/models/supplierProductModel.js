import { updateCatalogRecord } from './catalogModelHelpers.js';

function supplierProductFilters() {
  return `FROM supplier_products AS supplier_product
    JOIN suppliers AS supplier
      ON supplier.id = supplier_product.supplier_id
     AND supplier.organization_id = supplier_product.organization_id
    JOIN skus AS sku
      ON sku.id = supplier_product.sku_id
     AND sku.organization_id = supplier_product.organization_id
    JOIN product_variants AS variant
      ON variant.id = sku.product_variant_id
     AND variant.organization_id = sku.organization_id
    JOIN products AS product
      ON product.id = variant.product_id
     AND product.organization_id = variant.organization_id
    WHERE supplier_product.organization_id = $1
      AND (
        $2::text IS NULL
        OR supplier.name ILIKE $2
        OR sku.sku_code ILIKE $2
        OR supplier_product.supplier_sku_code ILIKE $2
        OR product.name ILIKE $2
      )
      AND ($3::uuid IS NULL OR supplier_product.supplier_id = $3)
      AND ($4::uuid IS NULL OR supplier_product.sku_id = $4)
      AND ($5::boolean IS NULL OR supplier_product.is_active = $5)
      AND ($6::boolean IS NULL OR supplier_product.preferred = $6)`;
}

export async function listSupplierProducts(
  database,
  { organizationId, search, supplierId, skuId, isActive, preferred, page, limit },
) {
  const parameters = [
    organizationId,
    search ? '%' + search + '%' : null,
    supplierId ?? null,
    skuId ?? null,
    isActive ?? null,
    preferred ?? null,
  ];
  const filters = supplierProductFilters();
  const countResult = await database.query(
    'SELECT COUNT(*)::int AS total ' + filters,
    parameters,
  );
  const result = await database.query(
    `SELECT supplier_product.id, supplier_product.organization_id,
            supplier_product.supplier_id, supplier_product.sku_id,
            supplier_product.supplier_sku_code,
            supplier_product.current_unit_cost, supplier_product.currency,
            supplier_product.moq, supplier_product.lead_time_days,
            supplier_product.preferred, supplier_product.is_active,
            supplier_product.notes, supplier_product.created_at,
            supplier_product.updated_at, supplier.name AS supplier_name,
            sku.sku_code, product.id AS product_id,
            product.name AS product_name, variant.name AS variant_name,
            (
              SELECT history.effective_from
              FROM supplier_price_history AS history
              WHERE history.supplier_product_id = supplier_product.id
                AND history.organization_id = supplier_product.organization_id
                AND history.effective_to IS NULL
            ) AS last_price_update
     ${filters}
     ORDER BY supplier_product.preferred DESC, supplier.name, sku.sku_code
     LIMIT $7 OFFSET $8`,
    [...parameters, limit, (page - 1) * limit],
  );
  return { rows: result.rows, total: countResult.rows[0].total };
}

export async function findSupplierProductById(
  database,
  { organizationId, id, forUpdate = false },
) {
  const result = await database.query(
    `SELECT supplier_product.id, supplier_product.organization_id,
            supplier_product.supplier_id, supplier_product.sku_id,
            supplier_product.supplier_sku_code,
            supplier_product.current_unit_cost, supplier_product.currency,
            supplier_product.moq, supplier_product.lead_time_days,
            supplier_product.preferred, supplier_product.is_active,
            supplier_product.notes, supplier_product.created_at,
            supplier_product.updated_at, supplier.name AS supplier_name,
            sku.sku_code, product.name AS product_name,
            variant.name AS variant_name
     FROM supplier_products AS supplier_product
     JOIN suppliers AS supplier
       ON supplier.id = supplier_product.supplier_id
      AND supplier.organization_id = supplier_product.organization_id
     JOIN skus AS sku
       ON sku.id = supplier_product.sku_id
      AND sku.organization_id = supplier_product.organization_id
     JOIN product_variants AS variant
       ON variant.id = sku.product_variant_id
      AND variant.organization_id = sku.organization_id
     JOIN products AS product
       ON product.id = variant.product_id
      AND product.organization_id = variant.organization_id
     WHERE supplier_product.id = $1
       AND supplier_product.organization_id = $2
     ${forUpdate ? 'FOR UPDATE OF supplier_product' : ''}`,
    [id, organizationId],
  );
  return result.rows[0] ?? null;
}

export async function createSupplierProduct(database, input) {
  const result = await database.query(
    `INSERT INTO supplier_products (
       organization_id, supplier_id, sku_id, supplier_sku_code,
       current_unit_cost, currency, moq, lead_time_days,
       preferred, is_active, notes
     )
     VALUES ($1, $2, $3, $4, $5::numeric, $6, $7::numeric, $8, $9, $10, $11)
     RETURNING *`,
    [
      input.organizationId,
      input.supplierId,
      input.skuId,
      input.supplierSkuCode ?? null,
      input.currentUnitCost,
      input.currency,
      input.moq,
      input.leadTimeDays,
      input.preferred,
      input.isActive,
      input.notes ?? null,
    ],
  );
  return result.rows[0];
}

export function updateSupplierProduct(database, { organizationId, id, changes }) {
  return updateCatalogRecord(database, {
    table: 'supplier_products',
    organizationId,
    id,
    changes,
  });
}

export async function clearPreferredForSku(
  database,
  { organizationId, skuId, exceptId = null },
) {
  await database.query(
    `UPDATE supplier_products
     SET preferred = FALSE
     WHERE organization_id = $1
       AND sku_id = $2
       AND preferred = TRUE
       AND ($3::uuid IS NULL OR id <> $3)`,
    [organizationId, skuId, exceptId],
  );
}

export async function createPriceHistory(database, input) {
  const result = await database.query(
    `INSERT INTO supplier_price_history (
       organization_id, supplier_product_id, unit_cost, currency,
       effective_from, source, notes
     )
     VALUES ($1, $2, $3::numeric, $4, $5, $6, $7)
     RETURNING *`,
    [
      input.organizationId,
      input.supplierProductId,
      input.unitCost,
      input.currency,
      input.effectiveFrom ?? new Date(),
      input.source ?? null,
      input.notes ?? null,
    ],
  );
  return result.rows[0];
}

export async function closeCurrentPriceHistory(
  database,
  { organizationId, supplierProductId, effectiveTo },
) {
  const result = await database.query(
    `UPDATE supplier_price_history
     SET effective_to = $3
     WHERE organization_id = $1
       AND supplier_product_id = $2
       AND effective_to IS NULL
     RETURNING id`,
    [organizationId, supplierProductId, effectiveTo],
  );
  return result.rowCount;
}

export async function listPriceHistory(
  database,
  { organizationId, supplierProductId, limit = 100 },
) {
  const result = await database.query(
    `SELECT id, organization_id, supplier_product_id, unit_cost, currency,
            effective_from, effective_to, source, notes, created_at
     FROM supplier_price_history
     WHERE organization_id = $1 AND supplier_product_id = $2
     ORDER BY effective_from DESC, created_at DESC
     LIMIT $3`,
    [organizationId, supplierProductId, limit],
  );
  return result.rows;
}

export async function findSku(database, { organizationId, id }) {
  const result = await database.query(
    `SELECT sku.id, sku.organization_id, sku.sku_code, sku.is_active,
            product.name AS product_name, variant.name AS variant_name
     FROM skus AS sku
     JOIN product_variants AS variant
       ON variant.id = sku.product_variant_id
      AND variant.organization_id = sku.organization_id
     JOIN products AS product
       ON product.id = variant.product_id
      AND product.organization_id = variant.organization_id
     WHERE sku.id = $1 AND sku.organization_id = $2`,
    [id, organizationId],
  );
  return result.rows[0] ?? null;
}
