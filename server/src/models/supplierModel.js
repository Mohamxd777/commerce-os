import { updateCatalogRecord } from './catalogModelHelpers.js';

export async function listSuppliers(
  database,
  { organizationId, search, isActive, page, limit },
) {
  const searchPattern = search ? '%' + search + '%' : null;
  const offset = (page - 1) * limit;
  const parameters = [organizationId, searchPattern, isActive ?? null];
  const filters = `FROM suppliers AS supplier
    LEFT JOIN supplier_products AS supplier_product
      ON supplier_product.supplier_id = supplier.id
     AND supplier_product.organization_id = supplier.organization_id
     AND supplier_product.is_active = TRUE
    LEFT JOIN purchase_orders AS purchase_order
      ON purchase_order.supplier_id = supplier.id
     AND purchase_order.organization_id = supplier.organization_id
    WHERE supplier.organization_id = $1
      AND (
        $2::text IS NULL
        OR supplier.name ILIKE $2
        OR supplier.legal_name ILIKE $2
        OR supplier.contact_person ILIKE $2
        OR supplier.email ILIKE $2
      )
      AND ($3::boolean IS NULL OR supplier.is_active = $3)`;

  const countResult = await database.query(
    'SELECT COUNT(DISTINCT supplier.id)::int AS total ' + filters,
    parameters,
  );
  const result = await database.query(
    `SELECT supplier.id, supplier.organization_id, supplier.name,
            supplier.legal_name, supplier.contact_person, supplier.phone,
            supplier.email, supplier.website_url, supplier.address,
            supplier.tax_number, supplier.notes, supplier.payment_terms_days,
            supplier.preferred_currency, supplier.is_active,
            supplier.created_at, supplier.updated_at,
            COUNT(DISTINCT supplier_product.id)::int AS linked_sku_count,
            COUNT(DISTINCT purchase_order.id)::int AS purchase_order_count
     ${filters}
     GROUP BY supplier.id
     ORDER BY supplier.is_active DESC, supplier.name, supplier.id
     LIMIT $4 OFFSET $5`,
    [...parameters, limit, offset],
  );

  return { rows: result.rows, total: countResult.rows[0].total };
}

export async function findSupplierById(database, { organizationId, id, forUpdate = false }) {
  const result = await database.query(
    `SELECT id, organization_id, name, legal_name, contact_person, phone,
            email, website_url, address, tax_number, notes,
            payment_terms_days, preferred_currency, is_active,
            created_at, updated_at
     FROM suppliers
     WHERE id = $1 AND organization_id = $2
     ${forUpdate ? 'FOR UPDATE' : ''}`,
    [id, organizationId],
  );
  return result.rows[0] ?? null;
}

export async function createSupplier(database, supplier) {
  const result = await database.query(
    `INSERT INTO suppliers (
       organization_id, name, legal_name, contact_person, phone, email,
       website_url, address, tax_number, notes, payment_terms_days,
       preferred_currency, is_active
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING id, organization_id, name, legal_name, contact_person, phone,
               email, website_url, address, tax_number, notes,
               payment_terms_days, preferred_currency, is_active,
               created_at, updated_at`,
    [
      supplier.organizationId,
      supplier.name,
      supplier.legalName ?? null,
      supplier.contactPerson ?? null,
      supplier.phone ?? null,
      supplier.email ?? null,
      supplier.websiteUrl ?? null,
      supplier.address ?? null,
      supplier.taxNumber ?? null,
      supplier.notes ?? null,
      supplier.paymentTermsDays ?? null,
      supplier.preferredCurrency,
      supplier.isActive,
    ],
  );
  return result.rows[0];
}

export function updateSupplier(database, { organizationId, id, changes }) {
  return updateCatalogRecord(database, {
    table: 'suppliers',
    organizationId,
    id,
    changes,
  });
}

export async function listSupplierPurchaseOrders(
  database,
  { organizationId, supplierId, limit = 25 },
) {
  const result = await database.query(
    `SELECT id, po_number, order_date, expected_delivery_date, currency,
            status, grand_total, created_at, updated_at
     FROM purchase_orders
     WHERE organization_id = $1 AND supplier_id = $2
     ORDER BY order_date DESC, created_at DESC
     LIMIT $3`,
    [organizationId, supplierId, limit],
  );
  return result.rows;
}

export async function listSupplierPriceHistory(
  database,
  { organizationId, supplierId, limit = 50 },
) {
  const result = await database.query(
    `SELECT history.id, history.supplier_product_id, history.unit_cost,
            history.currency, history.effective_from, history.effective_to,
            history.source, history.notes, history.created_at,
            sku.id AS sku_id, sku.sku_code, product.name AS product_name,
            variant.name AS variant_name
     FROM supplier_price_history AS history
     JOIN supplier_products AS supplier_product
       ON supplier_product.id = history.supplier_product_id
      AND supplier_product.organization_id = history.organization_id
     JOIN skus AS sku
       ON sku.id = supplier_product.sku_id
      AND sku.organization_id = supplier_product.organization_id
     JOIN product_variants AS variant
       ON variant.id = sku.product_variant_id
      AND variant.organization_id = sku.organization_id
     JOIN products AS product
       ON product.id = variant.product_id
      AND product.organization_id = variant.organization_id
     WHERE history.organization_id = $1
       AND supplier_product.supplier_id = $2
     ORDER BY history.effective_from DESC, history.created_at DESC
     LIMIT $3`,
    [organizationId, supplierId, limit],
  );
  return result.rows;
}
