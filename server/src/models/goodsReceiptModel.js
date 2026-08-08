export async function listGoodsReceipts(
  database,
  { organizationId, search, purchaseOrderId, locationId, dateFrom, dateTo, page, limit },
) {
  const parameters = [
    organizationId,
    search ? '%' + search + '%' : null,
    purchaseOrderId ?? null,
    locationId ?? null,
    dateFrom ?? null,
    dateTo ?? null,
  ];
  const filters = `FROM goods_receipts AS receipt
    JOIN purchase_orders AS purchase_order
      ON purchase_order.id = receipt.purchase_order_id
     AND purchase_order.organization_id = receipt.organization_id
    JOIN suppliers AS supplier
      ON supplier.id = purchase_order.supplier_id
     AND supplier.organization_id = purchase_order.organization_id
    JOIN locations AS location
      ON location.id = receipt.location_id
     AND location.organization_id = receipt.organization_id
    WHERE receipt.organization_id = $1
      AND (
        $2::text IS NULL
        OR receipt.receipt_number ILIKE $2
        OR purchase_order.po_number ILIKE $2
        OR supplier.name ILIKE $2
      )
      AND ($3::uuid IS NULL OR receipt.purchase_order_id = $3)
      AND ($4::uuid IS NULL OR receipt.location_id = $4)
      AND ($5::date IS NULL OR receipt.received_date >= $5)
      AND ($6::date IS NULL OR receipt.received_date <= $6)`;

  const countResult = await database.query(
    'SELECT COUNT(*)::int AS total ' + filters,
    parameters,
  );
  const result = await database.query(
    `SELECT receipt.id, receipt.organization_id, receipt.purchase_order_id,
            receipt.receipt_number, receipt.received_date,
            receipt.location_id, receipt.notes, receipt.received_by,
            receipt.created_at, purchase_order.po_number,
            supplier.name AS supplier_name, location.name AS location_name,
            (
              SELECT COUNT(*)::int
              FROM goods_receipt_items AS item
              WHERE item.goods_receipt_id = receipt.id
                AND item.organization_id = receipt.organization_id
            ) AS item_count,
            (
              SELECT COALESCE(SUM(item.quantity_received), 0)::numeric
              FROM goods_receipt_items AS item
              WHERE item.goods_receipt_id = receipt.id
                AND item.organization_id = receipt.organization_id
            ) AS accepted_quantity,
            (
              SELECT COALESCE(SUM(item.quantity_rejected), 0)::numeric
              FROM goods_receipt_items AS item
              WHERE item.goods_receipt_id = receipt.id
                AND item.organization_id = receipt.organization_id
            ) AS rejected_quantity
     ${filters}
     ORDER BY receipt.received_date DESC, receipt.created_at DESC
     LIMIT $7 OFFSET $8`,
    [...parameters, limit, (page - 1) * limit],
  );
  return { rows: result.rows, total: countResult.rows[0].total };
}

export async function findGoodsReceiptById(database, { organizationId, id }) {
  const result = await database.query(
    `SELECT receipt.id, receipt.organization_id, receipt.purchase_order_id,
            receipt.receipt_number, receipt.received_date,
            receipt.location_id, receipt.notes, receipt.received_by,
            receipt.created_at, purchase_order.po_number,
            purchase_order.status AS purchase_order_status,
            supplier.name AS supplier_name, location.name AS location_name,
            receiver.display_name AS received_by_name
     FROM goods_receipts AS receipt
     JOIN purchase_orders AS purchase_order
       ON purchase_order.id = receipt.purchase_order_id
      AND purchase_order.organization_id = receipt.organization_id
     JOIN suppliers AS supplier
       ON supplier.id = purchase_order.supplier_id
      AND supplier.organization_id = purchase_order.organization_id
     JOIN locations AS location
       ON location.id = receipt.location_id
      AND location.organization_id = receipt.organization_id
     JOIN users AS receiver ON receiver.id = receipt.received_by
     WHERE receipt.id = $1 AND receipt.organization_id = $2`,
    [id, organizationId],
  );
  return result.rows[0] ?? null;
}

export async function listGoodsReceiptItems(database, { organizationId, goodsReceiptId }) {
  const result = await database.query(
    `SELECT receipt_item.id, receipt_item.goods_receipt_id,
            receipt_item.purchase_order_item_id, receipt_item.sku_id,
            receipt_item.quantity_received, receipt_item.quantity_rejected,
            receipt_item.condition_notes, receipt_item.created_at,
            sku.sku_code, product.name AS product_name,
            variant.name AS variant_name, po_item.quantity_ordered
     FROM goods_receipt_items AS receipt_item
     JOIN purchase_order_items AS po_item
       ON po_item.id = receipt_item.purchase_order_item_id
      AND po_item.organization_id = receipt_item.organization_id
     JOIN skus AS sku
       ON sku.id = receipt_item.sku_id
      AND sku.organization_id = receipt_item.organization_id
     JOIN product_variants AS variant
       ON variant.id = sku.product_variant_id
      AND variant.organization_id = sku.organization_id
     JOIN products AS product
       ON product.id = variant.product_id
      AND product.organization_id = variant.organization_id
     WHERE receipt_item.goods_receipt_id = $1
       AND receipt_item.organization_id = $2
     ORDER BY receipt_item.created_at, receipt_item.id`,
    [goodsReceiptId, organizationId],
  );
  return result.rows;
}

export async function listReceiptsForPurchaseOrder(
  database,
  { organizationId, purchaseOrderId, limit = 100 },
) {
  const result = await database.query(
    `SELECT receipt.id, receipt.receipt_number, receipt.received_date,
            receipt.location_id, receipt.notes, receipt.created_at,
            location.name AS location_name,
            receiver.display_name AS received_by_name,
            COALESCE(SUM(item.quantity_received), 0)::numeric AS accepted_quantity,
            COALESCE(SUM(item.quantity_rejected), 0)::numeric AS rejected_quantity
     FROM goods_receipts AS receipt
     JOIN locations AS location
       ON location.id = receipt.location_id
      AND location.organization_id = receipt.organization_id
     JOIN users AS receiver ON receiver.id = receipt.received_by
     LEFT JOIN goods_receipt_items AS item
       ON item.goods_receipt_id = receipt.id
      AND item.organization_id = receipt.organization_id
     WHERE receipt.purchase_order_id = $1
       AND receipt.organization_id = $2
     GROUP BY receipt.id, location.name, receiver.display_name
     ORDER BY receipt.received_date DESC, receipt.created_at DESC
     LIMIT $3`,
    [purchaseOrderId, organizationId, limit],
  );
  return result.rows;
}

export async function createGoodsReceipt(database, input) {
  const result = await database.query(
    `INSERT INTO goods_receipts (
       organization_id, purchase_order_id, receipt_number,
       received_date, location_id, notes, received_by
     )
     VALUES ($1, $2, $3, $4::date, $5, $6, $7)
     RETURNING *`,
    [
      input.organizationId,
      input.purchaseOrderId,
      input.receiptNumber,
      input.receivedDate,
      input.locationId,
      input.notes ?? null,
      input.receivedBy,
    ],
  );
  return result.rows[0];
}

export async function createGoodsReceiptItem(database, input) {
  const result = await database.query(
    `INSERT INTO goods_receipt_items (
       organization_id, goods_receipt_id, purchase_order_item_id,
       sku_id, quantity_received, quantity_rejected, condition_notes
     )
     VALUES ($1, $2, $3, $4, $5::numeric, $6::numeric, $7)
     RETURNING *`,
    [
      input.organizationId,
      input.goodsReceiptId,
      input.purchaseOrderItemId,
      input.skuId,
      input.quantityReceived,
      input.quantityRejected,
      input.conditionNotes ?? null,
    ],
  );
  return result.rows[0];
}

export async function findLocation(database, { organizationId, id }) {
  const result = await database.query(
    `SELECT id, organization_id, name, code, status
     FROM locations
     WHERE id = $1 AND organization_id = $2`,
    [id, organizationId],
  );
  return result.rows[0] ?? null;
}

export async function purchaseOrderReceivingTotals(
  database,
  { organizationId, purchaseOrderId },
) {
  const result = await database.query(
    `SELECT COALESCE(SUM(item.quantity_ordered), 0)::numeric AS ordered_quantity,
            COALESCE(SUM(received.accepted_quantity), 0)::numeric AS accepted_quantity
     FROM purchase_order_items AS item
     LEFT JOIN LATERAL (
       SELECT SUM(receipt_item.quantity_received) AS accepted_quantity
       FROM goods_receipt_items AS receipt_item
       WHERE receipt_item.purchase_order_item_id = item.id
         AND receipt_item.organization_id = item.organization_id
     ) AS received ON TRUE
     WHERE item.purchase_order_id = $1
       AND item.organization_id = $2`,
    [purchaseOrderId, organizationId],
  );
  return result.rows[0];
}
