import { updateCatalogRecord } from './catalogModelHelpers.js';

function purchaseOrderFilters() {
  return `FROM purchase_orders AS purchase_order
    JOIN suppliers AS supplier
      ON supplier.id = purchase_order.supplier_id
     AND supplier.organization_id = purchase_order.organization_id
    WHERE purchase_order.organization_id = $1
      AND (
        $2::text IS NULL
        OR purchase_order.po_number ILIKE $2
        OR supplier.name ILIKE $2
      )
      AND ($3::uuid IS NULL OR purchase_order.supplier_id = $3)
      AND ($4::text IS NULL OR purchase_order.status = $4)
      AND ($5::date IS NULL OR purchase_order.order_date >= $5)
      AND ($6::date IS NULL OR purchase_order.order_date <= $6)
      AND ($7::date IS NULL OR purchase_order.expected_delivery_date >= $7)
      AND ($8::date IS NULL OR purchase_order.expected_delivery_date <= $8)`;
}

export async function listPurchaseOrders(
  database,
  {
    organizationId,
    search,
    supplierId,
    status,
    dateFrom,
    dateTo,
    expectedFrom,
    expectedTo,
    page,
    limit,
  },
) {
  const parameters = [
    organizationId,
    search ? '%' + search + '%' : null,
    supplierId ?? null,
    status ?? null,
    dateFrom ?? null,
    dateTo ?? null,
    expectedFrom ?? null,
    expectedTo ?? null,
  ];
  const filters = purchaseOrderFilters();
  const countResult = await database.query(
    'SELECT COUNT(*)::int AS total ' + filters,
    parameters,
  );
  const result = await database.query(
    `SELECT purchase_order.id, purchase_order.organization_id,
            purchase_order.supplier_id, purchase_order.po_number,
            purchase_order.order_date, purchase_order.expected_delivery_date,
            purchase_order.currency, purchase_order.payment_terms_days,
            purchase_order.notes, purchase_order.status,
            purchase_order.subtotal, purchase_order.discount_total,
            purchase_order.tax_total, purchase_order.shipping_cost,
            purchase_order.other_cost, purchase_order.grand_total,
            purchase_order.approved_at, purchase_order.created_at,
            purchase_order.updated_at, supplier.name AS supplier_name,
            (
              SELECT COUNT(*)::int
              FROM purchase_order_items AS item
              WHERE item.purchase_order_id = purchase_order.id
                AND item.organization_id = purchase_order.organization_id
            ) AS item_count,
            (
              SELECT COALESCE(SUM(receipt_item.quantity_received), 0)::numeric
              FROM purchase_order_items AS item
              JOIN goods_receipt_items AS receipt_item
                ON receipt_item.purchase_order_item_id = item.id
               AND receipt_item.organization_id = item.organization_id
              WHERE item.purchase_order_id = purchase_order.id
                AND item.organization_id = purchase_order.organization_id
            ) AS accepted_quantity
     ${filters}
     ORDER BY purchase_order.order_date DESC, purchase_order.created_at DESC
     LIMIT $9 OFFSET $10`,
    [...parameters, limit, (page - 1) * limit],
  );
  return { rows: result.rows, total: countResult.rows[0].total };
}

export async function findPurchaseOrderById(
  database,
  { organizationId, id, forUpdate = false },
) {
  if (forUpdate) {
    const result = await database.query(
      `SELECT * FROM purchase_orders
       WHERE id = $1 AND organization_id = $2
       FOR UPDATE`,
      [id, organizationId],
    );
    return result.rows[0] ?? null;
  }

  const result = await database.query(
    `SELECT purchase_order.id, purchase_order.organization_id,
            purchase_order.supplier_id, purchase_order.po_number,
            purchase_order.order_date, purchase_order.expected_delivery_date,
            purchase_order.currency, purchase_order.payment_terms_days,
            purchase_order.notes, purchase_order.status,
            purchase_order.subtotal, purchase_order.discount_total,
            purchase_order.tax_total, purchase_order.shipping_cost,
            purchase_order.other_cost, purchase_order.grand_total,
            purchase_order.created_by, purchase_order.approved_by,
            purchase_order.approved_at, purchase_order.created_at,
            purchase_order.updated_at, supplier.name AS supplier_name,
            supplier.email AS supplier_email, supplier.phone AS supplier_phone,
            creator.display_name AS created_by_name,
            approver.display_name AS approved_by_name
     FROM purchase_orders AS purchase_order
     JOIN suppliers AS supplier
       ON supplier.id = purchase_order.supplier_id
      AND supplier.organization_id = purchase_order.organization_id
     JOIN users AS creator ON creator.id = purchase_order.created_by
     LEFT JOIN users AS approver ON approver.id = purchase_order.approved_by
     WHERE purchase_order.id = $1
       AND purchase_order.organization_id = $2`,
    [id, organizationId],
  );
  return result.rows[0] ?? null;
}

export async function listPurchaseOrderItems(database, { organizationId, purchaseOrderId }) {
  const result = await database.query(
    `SELECT item.id, item.organization_id, item.purchase_order_id,
            item.sku_id, item.supplier_product_id, item.quantity_ordered,
            item.unit_cost, item.discount_amount, item.tax_amount,
            item.line_total, item.notes, item.created_at, item.updated_at,
            sku.sku_code, product.name AS product_name,
            variant.name AS variant_name,
            supplier_product.supplier_sku_code,
            COALESCE(SUM(receipt_item.quantity_received), 0)::numeric AS quantity_received,
            COALESCE(SUM(receipt_item.quantity_rejected), 0)::numeric AS quantity_rejected,
            GREATEST(
              item.quantity_ordered - COALESCE(SUM(receipt_item.quantity_received), 0),
              0
            )::numeric AS remaining_quantity
     FROM purchase_order_items AS item
     JOIN skus AS sku
       ON sku.id = item.sku_id
      AND sku.organization_id = item.organization_id
     JOIN product_variants AS variant
       ON variant.id = sku.product_variant_id
      AND variant.organization_id = sku.organization_id
     JOIN products AS product
       ON product.id = variant.product_id
      AND product.organization_id = variant.organization_id
     LEFT JOIN supplier_products AS supplier_product
       ON supplier_product.id = item.supplier_product_id
      AND supplier_product.organization_id = item.organization_id
     LEFT JOIN goods_receipt_items AS receipt_item
       ON receipt_item.purchase_order_item_id = item.id
      AND receipt_item.organization_id = item.organization_id
     WHERE item.purchase_order_id = $1
       AND item.organization_id = $2
     GROUP BY item.id, sku.sku_code, product.name, variant.name,
              supplier_product.supplier_sku_code
     ORDER BY item.created_at, item.id`,
    [purchaseOrderId, organizationId],
  );
  return result.rows;
}

export async function createPurchaseOrder(database, input) {
  const result = await database.query(
    `INSERT INTO purchase_orders (
       organization_id, supplier_id, po_number, order_date,
       expected_delivery_date, currency, payment_terms_days, notes,
       status, shipping_cost, other_cost, grand_total, created_by
     )
     VALUES (
       $1, $2, $3, $4::date, $5::date, $6, $7, $8, 'draft',
       $9::numeric, $10::numeric, ROUND($9::numeric + $10::numeric, 4), $11
     )
     RETURNING *`,
    [
      input.organizationId,
      input.supplierId,
      input.poNumber,
      input.orderDate,
      input.expectedDeliveryDate ?? null,
      input.currency,
      input.paymentTermsDays ?? null,
      input.notes ?? null,
      input.shippingCost,
      input.otherCost,
      input.createdBy,
    ],
  );
  return result.rows[0];
}

export async function createPurchaseOrderItem(database, input) {
  const result = await database.query(
    `INSERT INTO purchase_order_items (
       organization_id, purchase_order_id, sku_id, supplier_product_id,
       quantity_ordered, unit_cost, discount_amount, tax_amount,
       line_total, notes
     )
     VALUES (
       $1, $2, $3, $4, $5::numeric, $6::numeric, $7::numeric, $8::numeric,
       ROUND($5::numeric * $6::numeric - $7::numeric + $8::numeric, 4), $9
     )
     RETURNING *`,
    [
      input.organizationId,
      input.purchaseOrderId,
      input.skuId,
      input.supplierProductId ?? null,
      input.quantityOrdered,
      input.unitCost,
      input.discountAmount,
      input.taxAmount,
      input.notes ?? null,
    ],
  );
  return result.rows[0];
}

export async function deletePurchaseOrderItems(database, { organizationId, purchaseOrderId }) {
  await database.query(
    `DELETE FROM purchase_order_items
     WHERE organization_id = $1 AND purchase_order_id = $2`,
    [organizationId, purchaseOrderId],
  );
}

export async function recalculatePurchaseOrder(database, { organizationId, id }) {
  const result = await database.query(
    `UPDATE purchase_orders AS purchase_order
     SET subtotal = totals.subtotal,
         discount_total = totals.discount_total,
         tax_total = totals.tax_total,
         grand_total = ROUND(
           totals.subtotal - totals.discount_total + totals.tax_total
           + purchase_order.shipping_cost + purchase_order.other_cost,
           4
         )
     FROM (
       SELECT COALESCE(SUM(quantity_ordered * unit_cost), 0)::numeric AS subtotal,
              COALESCE(SUM(discount_amount), 0)::numeric AS discount_total,
              COALESCE(SUM(tax_amount), 0)::numeric AS tax_total
       FROM purchase_order_items
       WHERE organization_id = $1 AND purchase_order_id = $2
     ) AS totals
     WHERE purchase_order.id = $2
       AND purchase_order.organization_id = $1
     RETURNING purchase_order.*`,
    [organizationId, id],
  );
  return result.rows[0] ?? null;
}

export function updatePurchaseOrder(database, { organizationId, id, changes }) {
  return updateCatalogRecord(database, {
    table: 'purchase_orders',
    organizationId,
    id,
    changes,
  });
}

export async function transitionPurchaseOrder(
  database,
  { organizationId, id, fromStatuses, toStatus, approvedBy = null },
) {
  const result = await database.query(
    `UPDATE purchase_orders
     SET status = $4,
         approved_by = CASE WHEN $5::uuid IS NULL THEN approved_by ELSE $5 END,
         approved_at = CASE WHEN $5::uuid IS NULL THEN approved_at ELSE NOW() END
     WHERE id = $1
       AND organization_id = $2
       AND status = ANY($3::text[])
     RETURNING *`,
    [id, organizationId, fromStatuses, toStatus, approvedBy],
  );
  return result.rows[0] ?? null;
}

export async function setReceivingStatus(database, { organizationId, id, status }) {
  const result = await database.query(
    `UPDATE purchase_orders
     SET status = $3
     WHERE id = $1 AND organization_id = $2
     RETURNING *`,
    [id, organizationId, status],
  );
  return result.rows[0] ?? null;
}

export async function findPurchasingLineReference(
  database,
  { organizationId, supplierId, skuId, supplierProductId },
) {
  const result = await database.query(
    `SELECT sku.id AS sku_id, sku.sku_code, sku.is_active AS sku_is_active,
            supplier_product.id AS supplier_product_id,
            supplier_product.supplier_id,
            supplier_product.current_unit_cost,
            supplier_product.currency,
            supplier_product.moq,
            supplier_product.lead_time_days,
            supplier_product.is_active AS supplier_product_is_active
     FROM skus AS sku
     LEFT JOIN supplier_products AS supplier_product
       ON supplier_product.id = $4
      AND supplier_product.organization_id = sku.organization_id
     WHERE sku.id = $3
       AND sku.organization_id = $1
       AND (
         $4::uuid IS NULL
         OR (
           supplier_product.supplier_id = $2
           AND supplier_product.sku_id = sku.id
         )
       )`,
    [organizationId, supplierId, skuId, supplierProductId ?? null],
  );
  return result.rows[0] ?? null;
}

export async function lockPurchaseOrderItems(database, { organizationId, purchaseOrderId }) {
  const result = await database.query(
    `SELECT id, sku_id, quantity_ordered
     FROM purchase_order_items
     WHERE organization_id = $1 AND purchase_order_id = $2
     ORDER BY id
     FOR UPDATE`,
    [organizationId, purchaseOrderId],
  );
  return result.rows;
}

export async function totalAcceptedForItems(database, { organizationId, itemIds }) {
  const result = await database.query(
    `SELECT purchase_order_item_id,
            COALESCE(SUM(quantity_received), 0)::numeric AS accepted_quantity
     FROM goods_receipt_items
     WHERE organization_id = $1
       AND purchase_order_item_id = ANY($2::uuid[])
     GROUP BY purchase_order_item_id`,
    [organizationId, itemIds],
  );
  return result.rows;
}
