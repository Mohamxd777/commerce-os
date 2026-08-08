export async function getPurchasingSummary(
  database,
  { organizationId, dateFrom, dateTo },
) {
  const result = await database.query(
    `SELECT
       COUNT(*) FILTER (
         WHERE status IN ('approved', 'ordered', 'partially_received')
       )::int AS open_purchase_orders,
       COUNT(*) FILTER (WHERE status = 'draft')::int AS draft_purchase_orders,
       COUNT(*) FILTER (
         WHERE status IN ('approved', 'ordered', 'partially_received')
           AND expected_delivery_date IS NOT NULL
       )::int AS expected_deliveries,
       COUNT(*) FILTER (WHERE status = 'partially_received')::int AS partially_received,
       COALESCE(SUM(grand_total) FILTER (
         WHERE status <> 'cancelled'
           AND ($2::date IS NULL OR order_date >= $2)
           AND ($3::date IS NULL OR order_date <= $3)
       ), 0)::numeric AS total_purchase_order_value,
       (
         SELECT COUNT(*)::int
         FROM suppliers
         WHERE organization_id = $1 AND is_active = TRUE
       ) AS active_suppliers
     FROM purchase_orders
     WHERE organization_id = $1`,
    [organizationId, dateFrom ?? null, dateTo ?? null],
  );
  return result.rows[0];
}
