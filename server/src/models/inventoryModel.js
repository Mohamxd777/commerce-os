export async function findActiveSku(database, { organizationId, id }) {
  const result = await database.query(
    `SELECT sku.id, sku.organization_id, sku.sku_code, sku.is_active,
            sku.serial_tracking_enabled, variant.name AS variant_name,
            product.id AS product_id, product.name AS product_name
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

export async function findActiveLocation(database, { organizationId, id }) {
  const result = await database.query(
    `SELECT id, organization_id, name, code, status
     FROM locations
     WHERE id = $1 AND organization_id = $2`,
    [id, organizationId],
  );
  return result.rows[0] ?? null;
}

export async function appendMovement(database, input) {
  const result = await database.query(
    `INSERT INTO inventory_movements (
       organization_id, sku_id, location_id, movement_type, quantity,
       stock_bucket, reference_type, reference_id, correlation_id,
       idempotency_key, reason, notes, occurred_at, created_by
     ) VALUES (
       $1, $2, $3, $4, $5::numeric, $6, $7, $8, $9,
       $10, $11, $12, COALESCE($13::timestamptz, NOW()), $14
     )
     RETURNING *`,
    [
      input.organizationId,
      input.skuId,
      input.locationId,
      input.movementType,
      input.quantity,
      input.stockBucket,
      input.referenceType ?? null,
      input.referenceId ?? null,
      input.correlationId ?? null,
      input.idempotencyKey ?? null,
      input.reason ?? null,
      input.notes ?? null,
      input.occurredAt ?? null,
      input.createdBy,
    ],
  );
  return result.rows[0];
}

const stockDimensionsCte = `WITH dimensions AS (
    SELECT organization_id, sku_id, location_id FROM inventory_balances
    UNION
    SELECT organization_id, sku_id, location_id FROM inventory_reorder_rules
  ), stock AS (
    SELECT dimension.organization_id, dimension.sku_id, dimension.location_id,
           COALESCE(MAX(balance.quantity) FILTER (WHERE balance.stock_bucket = 'available'), 0)::numeric AS available,
           COALESCE(MAX(balance.quantity) FILTER (WHERE balance.stock_bucket = 'reserved'), 0)::numeric AS reserved,
           COALESCE(MAX(balance.quantity) FILTER (WHERE balance.stock_bucket = 'quarantine'), 0)::numeric AS quarantine,
           COALESCE(MAX(balance.quantity) FILTER (WHERE balance.stock_bucket = 'damaged'), 0)::numeric AS damaged
    FROM dimensions AS dimension
    LEFT JOIN inventory_balances AS balance
      ON balance.organization_id = dimension.organization_id
     AND balance.sku_id = dimension.sku_id
     AND balance.location_id = dimension.location_id
    GROUP BY dimension.organization_id, dimension.sku_id, dimension.location_id
  )`;

export async function listStock(
  database,
  { organizationId, search, skuId, locationId, lowStock, page, limit },
) {
  const parameters = [
    organizationId,
    search ? '%' + search + '%' : null,
    skuId ?? null,
    locationId ?? null,
    lowStock ?? null,
    limit,
    (page - 1) * limit,
  ];
  const result = await database.query(
    `${stockDimensionsCte}
     SELECT stock.sku_id, stock.location_id, sku.sku_code,
            sku.serial_tracking_enabled, variant.name AS variant_name,
            product.id AS product_id, product.name AS product_name,
            location.name AS location_name, location.code AS location_code,
            stock.available, stock.reserved, stock.quarantine, stock.damaged,
            (stock.available + stock.reserved + stock.quarantine + stock.damaged)::numeric AS total_physical,
            rule.id AS reorder_rule_id, rule.reorder_point, rule.safety_stock,
            rule.target_stock, rule.is_active AS reorder_rule_active,
            CASE
              WHEN stock.available = 0 THEN 'out_of_stock'
              WHEN rule.is_active = TRUE AND stock.available <= rule.reorder_point THEN 'low_stock'
              ELSE 'in_stock'
            END AS stock_status,
            COUNT(*) OVER()::int AS total_count
     FROM stock
     JOIN skus AS sku
       ON sku.id = stock.sku_id AND sku.organization_id = stock.organization_id
     JOIN product_variants AS variant
       ON variant.id = sku.product_variant_id AND variant.organization_id = sku.organization_id
     JOIN products AS product
       ON product.id = variant.product_id AND product.organization_id = variant.organization_id
     JOIN locations AS location
       ON location.id = stock.location_id AND location.organization_id = stock.organization_id
     LEFT JOIN inventory_reorder_rules AS rule
       ON rule.organization_id = stock.organization_id
      AND rule.sku_id = stock.sku_id
      AND rule.location_id = stock.location_id
     WHERE stock.organization_id = $1
       AND (
         $2::text IS NULL
         OR sku.sku_code ILIKE $2
         OR product.name ILIKE $2
         OR variant.name ILIKE $2
       )
       AND ($3::uuid IS NULL OR stock.sku_id = $3)
       AND ($4::uuid IS NULL OR stock.location_id = $4)
       AND (
         $5::boolean IS NULL
         OR $5 = FALSE
         OR (rule.is_active = TRUE AND stock.available <= rule.reorder_point)
       )
     ORDER BY product.name, variant.name, sku.sku_code, location.name
     LIMIT $6 OFFSET $7`,
    parameters,
  );
  return {
    rows: result.rows.map(({ total_count: _totalCount, ...row }) => row),
    total: result.rows[0]?.total_count ?? 0,
  };
}

export async function getInventorySummary(database, { organizationId }) {
  const totals = await database.query(
    `${stockDimensionsCte}
     SELECT
       COUNT(DISTINCT stock.sku_id) FILTER (
         WHERE stock.available + stock.reserved + stock.quarantine + stock.damaged > 0
       )::int AS active_skus_with_stock,
       COALESCE(SUM(stock.available), 0)::numeric AS available_units,
       COUNT(*) FILTER (
         WHERE rule.is_active = TRUE AND stock.available <= rule.reorder_point
       )::int AS low_stock_skus,
       COUNT(*) FILTER (WHERE stock.available = 0)::int AS out_of_stock_skus,
       COALESCE(SUM(stock.quarantine), 0)::numeric AS quarantined_units,
       COALESCE(SUM(stock.damaged), 0)::numeric AS damaged_units,
       (
         SELECT COUNT(*)::int FROM inventory_transfers
         WHERE organization_id = $1 AND status = 'in_transit'
       ) AS transfers_in_transit
     FROM stock
     LEFT JOIN inventory_reorder_rules AS rule
       ON rule.organization_id = stock.organization_id
      AND rule.sku_id = stock.sku_id
      AND rule.location_id = stock.location_id
     WHERE stock.organization_id = $1`,
    [organizationId],
  );
  const recent = await listMovements(database, {
    organizationId,
    page: 1,
    limit: 8,
  });
  return { ...totals.rows[0], recentMovements: recent.rows };
}

export async function listMovements(
  database,
  {
    organizationId,
    skuId,
    locationId,
    movementType,
    stockBucket,
    referenceType,
    dateFrom,
    dateTo,
    page,
    limit,
  },
) {
  const result = await database.query(
    `SELECT movement.id, movement.organization_id, movement.sku_id,
            movement.location_id, movement.movement_type, movement.quantity,
            movement.stock_bucket, movement.reference_type, movement.reference_id,
            movement.correlation_id, movement.reason, movement.notes,
            movement.occurred_at, movement.created_at,
            sku.sku_code, variant.name AS variant_name,
            product.id AS product_id, product.name AS product_name,
            location.name AS location_name, user_account.display_name AS created_by_name,
            COUNT(*) OVER()::int AS total_count
     FROM inventory_movements AS movement
     JOIN skus AS sku
       ON sku.id = movement.sku_id AND sku.organization_id = movement.organization_id
     JOIN product_variants AS variant
       ON variant.id = sku.product_variant_id AND variant.organization_id = sku.organization_id
     JOIN products AS product
       ON product.id = variant.product_id AND product.organization_id = variant.organization_id
     JOIN locations AS location
       ON location.id = movement.location_id AND location.organization_id = movement.organization_id
     JOIN users AS user_account ON user_account.id = movement.created_by
     WHERE movement.organization_id = $1
       AND ($2::uuid IS NULL OR movement.sku_id = $2)
       AND ($3::uuid IS NULL OR movement.location_id = $3)
       AND ($4::text IS NULL OR movement.movement_type = $4)
       AND ($5::text IS NULL OR movement.stock_bucket = $5)
       AND ($6::text IS NULL OR movement.reference_type = $6)
       AND ($7::date IS NULL OR movement.occurred_at >= $7::date)
       AND ($8::date IS NULL OR movement.occurred_at < ($8::date + INTERVAL '1 day'))
     ORDER BY movement.occurred_at DESC, movement.created_at DESC, movement.id DESC
     LIMIT $9 OFFSET $10`,
    [
      organizationId,
      skuId ?? null,
      locationId ?? null,
      movementType ?? null,
      stockBucket ?? null,
      referenceType ?? null,
      dateFrom ?? null,
      dateTo ?? null,
      limit,
      (page - 1) * limit,
    ],
  );
  return {
    rows: result.rows.map(({ total_count: _totalCount, ...row }) => row),
    total: result.rows[0]?.total_count ?? 0,
  };
}

export async function getSkuInventory(database, { organizationId, skuId }) {
  const sku = await findActiveSku(database, { organizationId, id: skuId });
  if (!sku) return null;

  const balances = await database.query(
    `SELECT location.id AS location_id, location.name AS location_name,
            location.code AS location_code,
            COALESCE(MAX(balance.quantity) FILTER (WHERE balance.stock_bucket = 'available'), 0)::numeric AS available,
            COALESCE(MAX(balance.quantity) FILTER (WHERE balance.stock_bucket = 'reserved'), 0)::numeric AS reserved,
            COALESCE(MAX(balance.quantity) FILTER (WHERE balance.stock_bucket = 'quarantine'), 0)::numeric AS quarantine,
            COALESCE(MAX(balance.quantity) FILTER (WHERE balance.stock_bucket = 'damaged'), 0)::numeric AS damaged
     FROM locations AS location
     LEFT JOIN inventory_balances AS balance
       ON balance.organization_id = location.organization_id
      AND balance.location_id = location.id
      AND balance.sku_id = $1
     WHERE location.organization_id = $2
       AND EXISTS (
         SELECT 1 FROM inventory_balances b
         WHERE b.organization_id = $2 AND b.sku_id = $1 AND b.location_id = location.id
         UNION ALL
         SELECT 1 FROM inventory_reorder_rules r
         WHERE r.organization_id = $2 AND r.sku_id = $1 AND r.location_id = location.id
       )
     GROUP BY location.id
     ORDER BY location.name`,
    [skuId, organizationId],
  );
  const rules = await listReorderRules(database, {
    organizationId,
    skuId,
    page: 1,
    limit: 100,
  });
  const movements = await listMovements(database, {
    organizationId,
    skuId,
    page: 1,
    limit: 50,
  });
  const transfers = await database.query(
    `SELECT transfer.id, transfer.transfer_number, transfer.status,
            source.name AS source_location_name,
            destination.name AS destination_location_name,
            item.quantity, transfer.shipped_at, transfer.received_at
     FROM inventory_transfer_items AS item
     JOIN inventory_transfers AS transfer
       ON transfer.id = item.inventory_transfer_id
      AND transfer.organization_id = item.organization_id
     JOIN locations AS source
       ON source.id = transfer.source_location_id
      AND source.organization_id = transfer.organization_id
     JOIN locations AS destination
       ON destination.id = transfer.destination_location_id
      AND destination.organization_id = transfer.organization_id
     WHERE item.organization_id = $1 AND item.sku_id = $2
     ORDER BY transfer.created_at DESC
     LIMIT 50`,
    [organizationId, skuId],
  );
  const suppliers = await database.query(
    `SELECT supplier.id AS supplier_id, supplier.name AS supplier_name,
            supplier_product.id AS supplier_product_id,
            supplier_product.current_unit_cost, supplier_product.currency,
            supplier_product.moq, supplier_product.lead_time_days,
            supplier_product.preferred
     FROM supplier_products AS supplier_product
     JOIN suppliers AS supplier
       ON supplier.id = supplier_product.supplier_id
      AND supplier.organization_id = supplier_product.organization_id
     WHERE supplier_product.organization_id = $1
       AND supplier_product.sku_id = $2
       AND supplier_product.is_active = TRUE
     ORDER BY supplier_product.preferred DESC, supplier_product.current_unit_cost, supplier.name`,
    [organizationId, skuId],
  );
  return {
    ...sku,
    balances: balances.rows,
    reorderRules: rules.rows,
    movements: movements.rows,
    transfers: transfers.rows,
    suppliers: suppliers.rows,
    serialTrackingNote: sku.serial_tracking_enabled
      ? 'Unit-level serial instances are intentionally deferred; this ledger keeps receipt, location, and reference foundations compatible with future serial association.'
      : null,
  };
}

export async function reconcileInventory(database, { organizationId }) {
  const result = await database.query(
    `WITH ledger AS (
       SELECT organization_id, sku_id, location_id, stock_bucket,
              SUM(quantity)::numeric AS ledger_quantity
       FROM inventory_movements
       WHERE organization_id = $1
       GROUP BY organization_id, sku_id, location_id, stock_bucket
     ), comparison AS (
       SELECT COALESCE(ledger.organization_id, balance.organization_id) AS organization_id,
              COALESCE(ledger.sku_id, balance.sku_id) AS sku_id,
              COALESCE(ledger.location_id, balance.location_id) AS location_id,
              COALESCE(ledger.stock_bucket, balance.stock_bucket) AS stock_bucket,
              COALESCE(ledger.ledger_quantity, 0)::numeric AS ledger_quantity,
              COALESCE(balance.quantity, 0)::numeric AS projected_quantity
       FROM ledger
       FULL OUTER JOIN inventory_balances AS balance
         ON balance.organization_id = ledger.organization_id
        AND balance.sku_id = ledger.sku_id
        AND balance.location_id = ledger.location_id
        AND balance.stock_bucket = ledger.stock_bucket
       WHERE COALESCE(ledger.organization_id, balance.organization_id) = $1
     )
     SELECT comparison.*, sku.sku_code, location.name AS location_name,
            (comparison.projected_quantity - comparison.ledger_quantity)::numeric AS difference
     FROM comparison
     JOIN skus AS sku
       ON sku.id = comparison.sku_id AND sku.organization_id = comparison.organization_id
     JOIN locations AS location
       ON location.id = comparison.location_id
      AND location.organization_id = comparison.organization_id
     WHERE comparison.ledger_quantity <> comparison.projected_quantity
     ORDER BY sku.sku_code, location.name, comparison.stock_bucket`,
    [organizationId],
  );
  return {
    reconciled: result.rows.length === 0,
    mismatchCount: result.rows.length,
    mismatches: result.rows,
    checkedAt: new Date().toISOString(),
  };
}

export async function listReorderRules(
  database,
  { organizationId, skuId, locationId, isActive, page, limit },
) {
  const result = await database.query(
    `SELECT rule.*, sku.sku_code, variant.name AS variant_name,
            product.id AS product_id, product.name AS product_name,
            location.name AS location_name, location.code AS location_code,
            COALESCE(balance.quantity, 0)::numeric AS available,
            supplier.name AS preferred_supplier_name,
            supplier_product.lead_time_days AS supplier_lead_time_days,
            COUNT(*) OVER()::int AS total_count
     FROM inventory_reorder_rules AS rule
     JOIN skus AS sku
       ON sku.id = rule.sku_id AND sku.organization_id = rule.organization_id
     JOIN product_variants AS variant
       ON variant.id = sku.product_variant_id AND variant.organization_id = sku.organization_id
     JOIN products AS product
       ON product.id = variant.product_id AND product.organization_id = variant.organization_id
     JOIN locations AS location
       ON location.id = rule.location_id AND location.organization_id = rule.organization_id
     LEFT JOIN inventory_balances AS balance
       ON balance.organization_id = rule.organization_id
      AND balance.sku_id = rule.sku_id
      AND balance.location_id = rule.location_id
      AND balance.stock_bucket = 'available'
     LEFT JOIN supplier_products AS supplier_product
       ON supplier_product.id = rule.preferred_supplier_product_id
      AND supplier_product.organization_id = rule.organization_id
     LEFT JOIN suppliers AS supplier
       ON supplier.id = supplier_product.supplier_id
      AND supplier.organization_id = supplier_product.organization_id
     WHERE rule.organization_id = $1
       AND ($2::uuid IS NULL OR rule.sku_id = $2)
       AND ($3::uuid IS NULL OR rule.location_id = $3)
       AND ($4::boolean IS NULL OR rule.is_active = $4)
     ORDER BY product.name, sku.sku_code, location.name
     LIMIT $5 OFFSET $6`,
    [organizationId, skuId ?? null, locationId ?? null, isActive ?? null, limit, (page - 1) * limit],
  );
  return {
    rows: result.rows.map(({ total_count: _totalCount, ...row }) => row),
    total: result.rows[0]?.total_count ?? 0,
  };
}

export async function findReorderRule(database, { organizationId, id, forUpdate = false }) {
  const result = await database.query(
    `SELECT * FROM inventory_reorder_rules
     WHERE id = $1 AND organization_id = $2${forUpdate ? ' FOR UPDATE' : ''}`,
    [id, organizationId],
  );
  return result.rows[0] ?? null;
}

export async function createReorderRule(database, input) {
  const result = await database.query(
    `INSERT INTO inventory_reorder_rules (
       organization_id, sku_id, location_id, reorder_point, safety_stock,
       target_stock, preferred_supplier_product_id, is_active
     ) VALUES ($1, $2, $3, $4::numeric, $5::numeric, $6::numeric, $7, $8)
     RETURNING *`,
    [input.organizationId, input.skuId, input.locationId, input.reorderPoint,
      input.safetyStock, input.targetStock ?? null, input.preferredSupplierProductId ?? null,
      input.isActive],
  );
  return result.rows[0];
}

export async function updateReorderRule(database, { organizationId, id, input }) {
  const result = await database.query(
    `UPDATE inventory_reorder_rules SET
       reorder_point = COALESCE($3::numeric, reorder_point),
       safety_stock = COALESCE($4::numeric, safety_stock),
       target_stock = CASE WHEN $5::boolean THEN $6::numeric ELSE target_stock END,
       preferred_supplier_product_id = CASE WHEN $7::boolean THEN $8::uuid ELSE preferred_supplier_product_id END,
       is_active = COALESCE($9::boolean, is_active)
     WHERE id = $1 AND organization_id = $2
     RETURNING *`,
    [id, organizationId, input.reorderPoint ?? null, input.safetyStock ?? null,
      Object.hasOwn(input, 'targetStock'), input.targetStock ?? null,
      Object.hasOwn(input, 'preferredSupplierProductId'), input.preferredSupplierProductId ?? null,
      input.isActive ?? null],
  );
  return result.rows[0] ?? null;
}

export async function validateSupplierProductForSku(
  database,
  { organizationId, id, skuId },
) {
  if (!id) return true;
  const result = await database.query(
    `SELECT 1 FROM supplier_products
     WHERE id = $1 AND organization_id = $2 AND sku_id = $3 AND is_active = TRUE`,
    [id, organizationId, skuId],
  );
  return result.rowCount === 1;
}

export async function listTransfers(
  database,
  { organizationId, search, status, locationId, page, limit },
) {
  const result = await database.query(
    `SELECT transfer.*, source.name AS source_location_name,
            destination.name AS destination_location_name,
            creator.display_name AS created_by_name,
            COUNT(item.id)::int AS item_count,
            COALESCE(SUM(item.quantity), 0)::numeric AS total_units,
            COUNT(*) OVER()::int AS total_count
     FROM inventory_transfers AS transfer
     JOIN locations AS source
       ON source.id = transfer.source_location_id AND source.organization_id = transfer.organization_id
     JOIN locations AS destination
       ON destination.id = transfer.destination_location_id AND destination.organization_id = transfer.organization_id
     JOIN users AS creator ON creator.id = transfer.created_by
     LEFT JOIN inventory_transfer_items AS item
       ON item.inventory_transfer_id = transfer.id AND item.organization_id = transfer.organization_id
     WHERE transfer.organization_id = $1
       AND ($2::text IS NULL OR transfer.transfer_number ILIKE $2)
       AND ($3::text IS NULL OR transfer.status = $3)
       AND ($4::uuid IS NULL OR transfer.source_location_id = $4 OR transfer.destination_location_id = $4)
     GROUP BY transfer.id, source.name, destination.name, creator.display_name
     ORDER BY transfer.created_at DESC
     LIMIT $5 OFFSET $6`,
    [organizationId, search ? '%' + search + '%' : null, status ?? null,
      locationId ?? null, limit, (page - 1) * limit],
  );
  return {
    rows: result.rows.map(({ total_count: _totalCount, ...row }) => row),
    total: result.rows[0]?.total_count ?? 0,
  };
}

export async function findTransfer(database, { organizationId, id, forUpdate = false }) {
  const result = await database.query(
    `SELECT transfer.*, source.name AS source_location_name,
            source.status AS source_location_status,
            destination.name AS destination_location_name,
            destination.status AS destination_location_status,
            creator.display_name AS created_by_name,
            shipper.display_name AS shipped_by_name,
            receiver.display_name AS received_by_name
     FROM inventory_transfers AS transfer
     JOIN locations AS source
       ON source.id = transfer.source_location_id AND source.organization_id = transfer.organization_id
     JOIN locations AS destination
       ON destination.id = transfer.destination_location_id AND destination.organization_id = transfer.organization_id
     JOIN users AS creator ON creator.id = transfer.created_by
     LEFT JOIN users AS shipper ON shipper.id = transfer.shipped_by
     LEFT JOIN users AS receiver ON receiver.id = transfer.received_by
     WHERE transfer.id = $1 AND transfer.organization_id = $2${forUpdate ? ' FOR UPDATE OF transfer' : ''}`,
    [id, organizationId],
  );
  return result.rows[0] ?? null;
}

export async function listTransferItems(database, { organizationId, transferId }) {
  const result = await database.query(
    `SELECT item.*, sku.sku_code, variant.name AS variant_name,
            product.id AS product_id, product.name AS product_name,
            COALESCE(balance.quantity, 0)::numeric AS source_available
     FROM inventory_transfer_items AS item
     JOIN inventory_transfers AS transfer
       ON transfer.id = item.inventory_transfer_id AND transfer.organization_id = item.organization_id
     JOIN skus AS sku
       ON sku.id = item.sku_id AND sku.organization_id = item.organization_id
     JOIN product_variants AS variant
       ON variant.id = sku.product_variant_id AND variant.organization_id = sku.organization_id
     JOIN products AS product
       ON product.id = variant.product_id AND product.organization_id = variant.organization_id
     LEFT JOIN inventory_balances AS balance
       ON balance.organization_id = item.organization_id
      AND balance.sku_id = item.sku_id
      AND balance.location_id = transfer.source_location_id
      AND balance.stock_bucket = 'available'
     WHERE item.inventory_transfer_id = $1 AND item.organization_id = $2
     ORDER BY sku.sku_code`,
    [transferId, organizationId],
  );
  return result.rows;
}

export async function createTransfer(database, input) {
  const result = await database.query(
    `INSERT INTO inventory_transfers (
       organization_id, transfer_number, source_location_id,
       destination_location_id, notes, created_by
     ) VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [input.organizationId, input.transferNumber, input.sourceLocationId,
      input.destinationLocationId, input.notes ?? null, input.createdBy],
  );
  return result.rows[0];
}

export async function replaceTransferItems(database, { organizationId, transferId, items }) {
  await database.query(
    `DELETE FROM inventory_transfer_items
     WHERE inventory_transfer_id = $1 AND organization_id = $2`,
    [transferId, organizationId],
  );
  for (const item of items) {
    await database.query(
      `INSERT INTO inventory_transfer_items (
         organization_id, inventory_transfer_id, sku_id, quantity
       ) VALUES ($1, $2, $3, $4::numeric)`,
      [organizationId, transferId, item.skuId, item.quantity],
    );
  }
}

export async function updateDraftTransfer(database, { organizationId, id, input }) {
  const result = await database.query(
    `UPDATE inventory_transfers SET
       source_location_id = COALESCE($3::uuid, source_location_id),
       destination_location_id = COALESCE($4::uuid, destination_location_id),
       notes = CASE WHEN $5::boolean THEN $6::text ELSE notes END
     WHERE id = $1 AND organization_id = $2
     RETURNING *`,
    [id, organizationId, input.sourceLocationId ?? null,
      input.destinationLocationId ?? null, Object.hasOwn(input, 'notes'), input.notes ?? null],
  );
  return result.rows[0];
}

export async function setTransferStatus(database, input) {
  const result = await database.query(
    `UPDATE inventory_transfers SET
       status = $3::varchar,
       shipped_at = CASE WHEN $3::varchar = 'in_transit' THEN NOW() ELSE shipped_at END,
       shipped_by = CASE WHEN $3::varchar = 'in_transit' THEN $4::uuid ELSE shipped_by END,
       received_at = CASE WHEN $3::varchar = 'received' THEN NOW() ELSE received_at END,
       received_by = CASE WHEN $3::varchar = 'received' THEN $4::uuid ELSE received_by END
     WHERE id = $1 AND organization_id = $2
     RETURNING *`,
    [input.id, input.organizationId, input.status, input.userId ?? null],
  );
  return result.rows[0];
}

export async function findGoodsReceiptForPosting(
  database,
  { organizationId, id, forUpdate = false },
) {
  const result = await database.query(
    `SELECT receipt.*, location.status AS location_status
     FROM goods_receipts AS receipt
     JOIN locations AS location
       ON location.id = receipt.location_id AND location.organization_id = receipt.organization_id
     WHERE receipt.id = $1 AND receipt.organization_id = $2${forUpdate ? ' FOR UPDATE OF receipt' : ''}`,
    [id, organizationId],
  );
  return result.rows[0] ?? null;
}

export async function listGoodsReceiptItemsForPosting(
  database,
  { organizationId, receiptId },
) {
  const result = await database.query(
    `SELECT id, sku_id, quantity_received, quantity_rejected
     FROM goods_receipt_items
     WHERE goods_receipt_id = $1 AND organization_id = $2
     ORDER BY id`,
    [receiptId, organizationId],
  );
  return result.rows;
}

export async function markGoodsReceiptPosted(database, input) {
  const result = await database.query(
    `UPDATE goods_receipts
     SET inventory_posted_at = NOW(), inventory_posted_by = $3
     WHERE id = $1 AND organization_id = $2 AND inventory_posted_at IS NULL
     RETURNING *`,
    [input.id, input.organizationId, input.userId],
  );
  return result.rows[0] ?? null;
}
