import { updateCatalogRecord } from './catalogModelHelpers.js';

const candidateSelect = `
  SELECT candidate.id, candidate.organization_id, candidate.category_id,
         candidate.name, candidate.brand_name, candidate.marketplace_url,
         candidate.description, candidate.model_number, candidate.gtin,
         candidate.planned_selling_price, candidate.planned_price_currency,
         candidate.status, candidate.notes, candidate.catalog_product_id,
         candidate.converted_at, candidate.created_at, candidate.updated_at,
         category.name AS category_name,
         latest_snapshot.selling_price AS market_price,
         latest_snapshot.currency AS market_currency,
         latest_snapshot.rating, latest_snapshot.review_count,
         latest_snapshot.demand_score, latest_snapshot.competition_score,
         market_summary.minimum_observed_price, market_summary.median_observed_price,
         market_summary.observation_count,
         preferred_supplier.id AS preferred_supplier_option_id,
         COALESCE(preferred_supplier.supplier_name, preferred_supplier.lead_name) AS preferred_supplier_name,
         preferred_supplier.quoted_unit_cost, preferred_supplier.currency AS supplier_currency,
         preferred_supplier.moq,
         preferred_supplier.lead_time_days,
         cheapest_supplier.id AS cheapest_supplier_option_id,
         COALESCE(cheapest_supplier.supplier_name, cheapest_supplier.lead_name) AS cheapest_supplier_name,
         cheapest_supplier.quoted_unit_cost AS cheapest_unit_cost,
         cheapest_supplier.currency AS cheapest_supplier_currency,
         latest_sample.result AS sample_result,
         latest_sample.workflow_state AS sample_state,
         latest_economics.net_margin_percentage,
         latest_economics.roi_percentage,
         latest_economics.net_contribution,
         latest_evaluation.recommendation,
         latest_evaluation.risk_level,
         latest_evaluation.planned_capital,
         latest_evaluation.projected_profit,
         CASE
           WHEN candidate.status = 'launched' THEN 'sku'
           WHEN candidate.status IN ('approved', 'rejected') OR latest_evaluation.recommendation IS NOT NULL THEN 'decision'
           WHEN latest_sample.workflow_state IS NOT NULL THEN 'sample'
           WHEN latest_economics.net_margin_percentage IS NOT NULL THEN 'economics'
           WHEN market_summary.observation_count > 0 THEN 'market'
           WHEN cheapest_supplier.id IS NOT NULL THEN 'supplier'
           ELSE 'idea'
         END AS current_stage
  FROM product_candidates AS candidate
  LEFT JOIN categories AS category
    ON category.id = candidate.category_id
   AND category.organization_id = candidate.organization_id
  LEFT JOIN LATERAL (
    SELECT snapshot.* FROM product_candidate_market_snapshots AS snapshot
    WHERE snapshot.candidate_id = candidate.id
      AND snapshot.organization_id = candidate.organization_id
    ORDER BY snapshot.observed_at DESC, snapshot.created_at DESC LIMIT 1
  ) AS latest_snapshot ON TRUE
  LEFT JOIN LATERAL (
    SELECT MIN(snapshot.selling_price) AS minimum_observed_price,
           PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY snapshot.selling_price)::numeric(19, 4)
             AS median_observed_price,
           COUNT(*)::int AS observation_count
    FROM product_candidate_market_snapshots AS snapshot
    WHERE snapshot.candidate_id = candidate.id
      AND snapshot.organization_id = candidate.organization_id
  ) AS market_summary ON TRUE
  LEFT JOIN LATERAL (
    SELECT option.*, supplier.name AS supplier_name
    FROM candidate_supplier_options AS option
    LEFT JOIN suppliers AS supplier
      ON supplier.id = option.supplier_id
     AND supplier.organization_id = option.organization_id
    WHERE option.candidate_id = candidate.id
      AND option.organization_id = candidate.organization_id
      AND option.preferred = TRUE
    ORDER BY option.created_at LIMIT 1
  ) AS preferred_supplier ON TRUE
  LEFT JOIN LATERAL (
    SELECT option.*, supplier.name AS supplier_name
    FROM candidate_supplier_options AS option
    LEFT JOIN suppliers AS supplier
      ON supplier.id = option.supplier_id
     AND supplier.organization_id = option.organization_id
    WHERE option.candidate_id = candidate.id
      AND option.organization_id = candidate.organization_id
    ORDER BY option.quoted_unit_cost, option.created_at LIMIT 1
  ) AS cheapest_supplier ON TRUE
  LEFT JOIN LATERAL (
    SELECT sample.result, sample.workflow_state FROM product_samples AS sample
    WHERE sample.candidate_id = candidate.id
      AND sample.organization_id = candidate.organization_id
    ORDER BY sample.created_at DESC LIMIT 1
  ) AS latest_sample ON TRUE
  LEFT JOIN LATERAL (
    SELECT economics.net_margin_percentage, economics.roi_percentage,
           economics.net_contribution
    FROM candidate_unit_economics AS economics
    WHERE economics.candidate_id = candidate.id
      AND economics.organization_id = candidate.organization_id
    ORDER BY economics.created_at DESC LIMIT 1
  ) AS latest_economics ON TRUE
  LEFT JOIN LATERAL (
    SELECT evaluation.recommendation, evaluation.risk_level,
           evaluation.planned_capital, evaluation.projected_profit
    FROM candidate_launch_evaluations AS evaluation
    WHERE evaluation.candidate_id = candidate.id
      AND evaluation.organization_id = candidate.organization_id
    ORDER BY evaluation.created_at DESC LIMIT 1
  ) AS latest_evaluation ON TRUE`;

export async function listCandidates(database, input) {
  const searchPattern = input.search ? '%' + input.search + '%' : null;
  const parameters = [
    input.organizationId,
    searchPattern,
    input.status ?? null,
    input.categoryId ?? null,
    input.decision ?? null,
    input.risk ?? null,
    input.supplier ?? null,
    input.sample ?? null,
    input.supplierId ?? null,
  ];
  const filters = `
    WHERE candidate.organization_id = $1
      AND ($2::text IS NULL OR candidate.name ILIKE $2 OR candidate.brand_name ILIKE $2
        OR candidate.model_number ILIKE $2 OR candidate.gtin ILIKE $2
        OR candidate.marketplace_url ILIKE $2 OR candidate.notes ILIKE $2
        OR latest_snapshot.listing_url ILIKE $2 OR latest_snapshot.listing_title ILIKE $2
        OR latest_snapshot.seller_brand ILIKE $2
        OR preferred_supplier.supplier_name ILIKE $2 OR preferred_supplier.lead_name ILIKE $2)
      AND ($3::text IS NULL OR candidate.status = $3)
      AND ($4::uuid IS NULL OR candidate.category_id = $4)
      AND ($5::text IS NULL OR latest_evaluation.recommendation = $5)
      AND ($6::text IS NULL OR latest_evaluation.risk_level = $6)
      AND ($7::boolean IS NULL OR (cheapest_supplier.id IS NOT NULL) = $7)
      AND ($8::boolean IS NULL OR (latest_sample.result IS NOT NULL) = $8)
      AND ($9::uuid IS NULL OR EXISTS (
        SELECT 1 FROM candidate_supplier_options AS supplier_filter
        WHERE supplier_filter.organization_id = candidate.organization_id
          AND supplier_filter.candidate_id = candidate.id
          AND supplier_filter.supplier_id = $9
      ))`;

  const count = await database.query(
    `SELECT COUNT(*)::int AS total FROM (${candidateSelect} ${filters}) AS filtered`,
    parameters,
  );
  const offset = (input.page - 1) * input.limit;
  const result = await database.query(
    `${candidateSelect} ${filters}
     ORDER BY candidate.updated_at DESC, candidate.id
     LIMIT $10 OFFSET $11`,
    [...parameters, input.limit, offset],
  );
  return { rows: result.rows, total: count.rows[0].total };
}

export async function findCandidate(database, { organizationId, id, forUpdate = false }) {
  const result = await database.query(
    `${candidateSelect}
     WHERE candidate.organization_id = $1 AND candidate.id = $2
     ${forUpdate ? 'FOR UPDATE OF candidate' : ''}`,
    [organizationId, id],
  );
  return result.rows[0] ?? null;
}

export async function createCandidate(database, input) {
  const result = await database.query(
    `INSERT INTO product_candidates (
       organization_id, category_id, name, brand_name, marketplace_url,
       description, model_number, gtin, planned_selling_price,
       planned_price_currency, status, notes, created_by
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING *`,
    [input.organizationId, input.categoryId ?? null, input.name,
      input.brandName ?? null, input.marketplaceUrl ?? null,
      input.description ?? null, input.modelNumber ?? null, input.gtin ?? null,
      input.plannedSellingPrice ?? null, input.plannedPriceCurrency ?? null,
      input.status, input.notes ?? null, input.userId],
  );
  return result.rows[0];
}

export function updateCandidate(database, { organizationId, id, changes }) {
  return updateCatalogRecord(database, {
    table: 'product_candidates', organizationId, id, changes,
  });
}

export async function listCandidateCollection(database, { table, organizationId, candidateId, orderBy }) {
  const result = await database.query(
    `SELECT * FROM ${table} WHERE organization_id = $1 AND candidate_id = $2 ORDER BY ${orderBy}`,
    [organizationId, candidateId],
  );
  return result.rows;
}

export async function createSnapshot(database, input) {
  const result = await database.query(
    `INSERT INTO product_candidate_market_snapshots (
       organization_id, candidate_id, marketplace, listing_url, observed_at,
       selling_price, currency, rating, review_count, demand_score,
       competition_score, evidence_notes, listing_title, seller_brand,
       original_price, recent_sales_signal, bestseller_rank_text,
       fulfillment_badge, created_by
     ) VALUES ($1, $2, $3, $4, COALESCE($5, NOW()), $6, $7, $8, $9, $10,
       $11, $12, $13, $14, $15, $16, $17, $18, $19)
     RETURNING *`,
    [input.organizationId, input.candidateId, input.marketplace, input.listingUrl,
      input.observedAt ?? null, input.sellingPrice ?? null, input.currency ?? null,
      input.rating ?? null, input.reviewCount ?? null, input.demandScore ?? null,
      input.competitionScore ?? null, input.evidenceNotes ?? null,
      input.listingTitle ?? null, input.sellerBrand ?? null,
      input.originalPrice ?? null, input.recentSalesSignal ?? null,
      input.bestsellerRankText ?? null, input.fulfillmentBadge ?? null, input.userId],
  );
  return result.rows[0];
}

export async function listSupplierOptions(database, { organizationId, candidateId }) {
  const result = await database.query(
    `SELECT option.*, supplier.name AS supplier_name
     FROM candidate_supplier_options AS option
     LEFT JOIN suppliers AS supplier
       ON supplier.id = option.supplier_id
      AND supplier.organization_id = option.organization_id
     WHERE option.organization_id = $1 AND option.candidate_id = $2
     ORDER BY option.preferred DESC, option.quoted_unit_cost, option.created_at`,
    [organizationId, candidateId],
  );
  return result.rows;
}

export async function findSupplierOption(database, { organizationId, id }) {
  const result = await database.query(
    `SELECT option.*, supplier.name AS supplier_name
     FROM candidate_supplier_options AS option
     LEFT JOIN suppliers AS supplier ON supplier.id = option.supplier_id
       AND supplier.organization_id = option.organization_id
     WHERE option.organization_id = $1 AND option.id = $2`,
    [organizationId, id],
  );
  return result.rows[0] ?? null;
}

export async function createSupplierOption(database, input) {
  if (input.preferred) {
    await database.query(
      'UPDATE candidate_supplier_options SET preferred = FALSE WHERE organization_id = $1 AND candidate_id = $2',
      [input.organizationId, input.candidateId],
    );
  }
  const result = await database.query(
    `INSERT INTO candidate_supplier_options (
       organization_id, candidate_id, supplier_id, lead_name, contact_url,
       quoted_unit_cost, currency, moq, lead_time_days, quote_date,
       quote_valid_until, preferred, notes, model_variant,
       same_price_all_quantities, price_qty_1, price_qty_5, price_qty_10,
       price_qty_20, price_qty_50, price_qty_100, warranty_text,
       defective_unit_replacement, invoice_available, sample_available
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
       $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
     RETURNING *`,
    [input.organizationId, input.candidateId, input.supplierId ?? null,
      input.leadName ?? null, input.contactUrl ?? null, input.quotedUnitCost,
      input.currency, input.moq, input.leadTimeDays, input.quoteDate ?? null,
      input.quoteValidUntil ?? null, input.preferred, input.notes ?? null,
      input.modelVariant ?? null, input.samePriceAllQuantities,
      input.priceQty1 ?? null, input.priceQty5 ?? null, input.priceQty10 ?? null,
      input.priceQty20 ?? null, input.priceQty50 ?? null, input.priceQty100 ?? null,
      input.warrantyText ?? null, input.defectiveUnitReplacement ?? null,
      input.invoiceAvailable ?? null, input.sampleAvailable ?? null],
  );
  return result.rows[0];
}

export async function updateSupplierOption(database, { organizationId, id, changes, candidateId }) {
  if (changes.preferred === true) {
    await database.query(
      'UPDATE candidate_supplier_options SET preferred = FALSE WHERE organization_id = $1 AND candidate_id = $2 AND id <> $3',
      [organizationId, candidateId, id],
    );
  }
  return updateCatalogRecord(database, {
    table: 'candidate_supplier_options', organizationId, id, changes,
  });
}

export async function findSample(database, { organizationId, id }) {
  const result = await database.query(
    `SELECT * FROM product_samples WHERE organization_id = $1 AND id = $2`,
    [organizationId, id],
  );
  return result.rows[0] ?? null;
}

export async function createSample(database, input) {
  const workflowState = input.workflowState ?? ({ pass: 'passed', fail: 'failed' }[input.result] || 'not_requested');
  const storedResult = workflowState === 'passed' ? 'pass' : workflowState === 'failed' ? 'fail' : input.result;
  const evaluated = storedResult !== 'pending';
  const result = await database.query(
    `INSERT INTO product_samples (
       organization_id, candidate_id, supplier_option_id, reference_code,
       ordered_at, received_at, sample_cost, currency, result, checklist,
       notes, evaluated_by, evaluated_at, created_by, workflow_state
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11,
       CASE WHEN $12 THEN $13::uuid ELSE NULL END,
       CASE WHEN $12 THEN NOW() ELSE NULL END, $13, $14)
     RETURNING *`,
    [input.organizationId, input.candidateId, input.supplierOptionId ?? null,
      input.referenceCode ?? null, input.orderedAt ?? null, input.receivedAt ?? null,
      input.sampleCost ?? null, input.currency ?? null, storedResult,
      JSON.stringify(input.checklist), input.notes ?? null, evaluated, input.userId,
      workflowState],
  );
  return result.rows[0];
}

export function updateSample(database, { organizationId, id, changes }) {
  return updateCatalogRecord(database, {
    table: 'product_samples', organizationId, id, changes,
  });
}

export async function createFeeAssumption(database, input) {
  const result = await database.query(
    `INSERT INTO candidate_fee_assumptions (
       organization_id, candidate_id, fee_name, fee_type, fee_value, currency,
       effective_from, effective_to, source_url, notes, created_by
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [input.organizationId, input.candidateId, input.feeName, input.feeType,
      input.feeValue, input.currency ?? null, input.effectiveFrom,
      input.effectiveTo ?? null, input.sourceUrl ?? null, input.notes ?? null, input.userId],
  );
  return result.rows[0];
}

export async function createEvidence(database, input) {
  const result = await database.query(
    `INSERT INTO product_candidate_evidence (
       organization_id, candidate_id, evidence_type, title, source_url,
       storage_key, original_filename, media_type, notes, created_by
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [input.organizationId, input.candidateId, input.evidenceType, input.title,
      input.sourceUrl ?? null, input.storageKey ?? null,
      input.originalFilename ?? null, input.mediaType ?? null,
      input.notes ?? null, input.userId],
  );
  return result.rows[0];
}

export async function calculateAndStoreEconomics(database, input) {
  const result = await database.query(
    `WITH values AS (
       SELECT $1::uuid AS organization_id, $2::uuid AS candidate_id,
         $3::varchar AS currency, $4::numeric AS selling_price,
         $5::numeric AS supplier_unit_cost, $6::numeric AS local_transport_cost,
         $7::numeric AS packaging_cost, $8::numeric AS referral_fee_percentage,
         $9::numeric AS referral_fee_fixed, $10::numeric AS fulfillment_fee,
         $11::numeric AS shipping_reimbursement, $12::numeric AS advertising_cost,
         $13::numeric AS estimated_return_reserve, $14::numeric AS other_variable_costs,
         $15::numeric AS target_margin_percentage, $16::numeric AS target_roi_percentage,
         $17::uuid AS created_by
     ), costs AS (
       SELECT values.*,
         ROUND(selling_price * referral_fee_percentage / 100, 4) AS referral_fee_amount,
         ROUND(local_transport_cost + packaging_cost + referral_fee_fixed + fulfillment_fee
           + advertising_cost + estimated_return_reserve + other_variable_costs
           - shipping_reimbursement, 4) AS non_purchase_fixed_cost
       FROM values
     ), calculated AS (
       SELECT costs.*,
         ROUND(supplier_unit_cost + non_purchase_fixed_cost + referral_fee_amount, 4) AS total_cost,
         ROUND(selling_price - supplier_unit_cost, 4) AS calculated_gross_profit,
         ROUND((supplier_unit_cost + non_purchase_fixed_cost) /
           (1 - referral_fee_percentage / 100), 4) AS calculated_break_even
       FROM costs
     )
     INSERT INTO candidate_unit_economics (
       organization_id, candidate_id, supplier_option_id, currency, selling_price, supplier_unit_cost,
       local_transport_cost, packaging_cost, referral_fee_percentage,
       referral_fee_fixed, fulfillment_fee, shipping_reimbursement,
       advertising_cost, estimated_return_reserve, other_variable_costs,
       target_margin_percentage, target_roi_percentage, total_variable_cost,
       gross_profit, net_contribution, net_margin_percentage, roi_percentage,
       break_even_price, max_purchase_price_for_target_margin,
       max_purchase_price_for_target_roi, created_by
     )
     SELECT organization_id, candidate_id, $18::uuid, currency, selling_price, supplier_unit_cost,
       local_transport_cost, packaging_cost, referral_fee_percentage,
       referral_fee_fixed, fulfillment_fee, shipping_reimbursement,
       advertising_cost, estimated_return_reserve, other_variable_costs,
       target_margin_percentage, target_roi_percentage, total_cost,
       calculated_gross_profit, ROUND(selling_price - total_cost, 4),
       ROUND((selling_price - total_cost) / NULLIF(selling_price, 0) * 100, 4),
       ROUND((selling_price - total_cost) / NULLIF(total_cost, 0) * 100, 4),
       calculated_break_even,
       CASE WHEN target_margin_percentage IS NULL THEN NULL ELSE
         ROUND(selling_price * (1 - target_margin_percentage / 100)
           - non_purchase_fixed_cost - referral_fee_amount, 4) END,
       CASE WHEN target_roi_percentage IS NULL THEN NULL ELSE
         ROUND(selling_price / (1 + target_roi_percentage / 100)
           - non_purchase_fixed_cost - referral_fee_amount, 4) END,
       created_by
     FROM calculated
     RETURNING *`,
    [input.organizationId, input.candidateId, input.currency, input.sellingPrice,
      input.supplierUnitCost, input.localTransportCost, input.packagingCost,
      input.referralFeePercentage, input.referralFeeFixed, input.fulfillmentFee,
      input.shippingReimbursement, input.advertisingCost,
      input.estimatedReturnReserve, input.otherVariableCosts,
      input.targetMarginPercentage ?? null, input.targetRoiPercentage ?? null, input.userId,
      input.supplierOptionId ?? null],
  );
  return result.rows[0];
}

export async function createEvaluation(database, input) {
  const result = await database.query(
    `INSERT INTO candidate_launch_evaluations (
       organization_id, candidate_id, unit_economics_id, recommendation,
       risk_level, target_selling_price, target_unit_cost,
       target_margin_percentage, target_roi_percentage, launch_quantity,
       planned_capital, projected_profit, rationale, created_by
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING *`,
    [input.organizationId, input.candidateId, input.unitEconomicsId ?? null,
      input.recommendation, input.riskLevel, input.targetSellingPrice,
      input.targetUnitCost, input.targetMarginPercentage, input.targetRoiPercentage,
      input.launchQuantity, input.plannedCapital, input.projectedProfit,
      input.rationale, input.userId],
  );
  return result.rows[0];
}

export async function getSettings(database, { organizationId }) {
  await database.query(
    `INSERT INTO research_settings (organization_id)
     VALUES ($1) ON CONFLICT (organization_id) DO NOTHING`,
    [organizationId],
  );
  const result = await database.query(
    'SELECT * FROM research_settings WHERE organization_id = $1',
    [organizationId],
  );
  return result.rows[0];
}

export function updateSettings(database, { organizationId, id, changes }) {
  return updateCatalogRecord(database, {
    table: 'research_settings', organizationId, id, changes,
  });
}

export async function getSummary(database, { organizationId }) {
  const settings = await getSettings(database, { organizationId });
  const result = await database.query(
    `WITH latest_evaluation AS (
       SELECT DISTINCT ON (candidate_id) candidate_id, recommendation, risk_level,
         planned_capital, projected_profit
       FROM candidate_launch_evaluations WHERE organization_id = $1
       ORDER BY candidate_id, created_at DESC
     ), latest_sample AS (
       SELECT DISTINCT ON (candidate_id) candidate_id, result
       FROM product_samples WHERE organization_id = $1
       ORDER BY candidate_id, created_at DESC
     ), latest_economics AS (
       SELECT DISTINCT ON (candidate_id) candidate_id, net_margin_percentage, roi_percentage
       FROM candidate_unit_economics WHERE organization_id = $1
       ORDER BY candidate_id, created_at DESC
     )
     SELECT
       COUNT(*)::int AS total_candidates,
       COUNT(*) FILTER (WHERE candidate.status = 'research')::int AS in_research,
       COUNT(*) FILTER (WHERE candidate.status = 'shortlisted')::int AS shortlisted,
       COUNT(*) FILTER (WHERE candidate.status = 'sampling')::int AS sampling,
       COUNT(*) FILTER (WHERE candidate.status = 'approved')::int AS approved,
       COUNT(*) FILTER (WHERE candidate.status = 'rejected')::int AS rejected,
       COUNT(*) FILTER (WHERE latest_sample.result = 'pending')::int AS samples_pending,
       COUNT(*) FILTER (WHERE latest_evaluation.recommendation = 'buy')::int AS buy_recommendations,
       COUNT(*) FILTER (WHERE latest_evaluation.risk_level = 'high')::int AS high_risk,
       COALESCE(ROUND(AVG(latest_economics.net_margin_percentage), 4), 0) AS average_margin,
       COALESCE(ROUND(AVG(latest_economics.roi_percentage), 4), 0) AS average_roi,
       COALESCE(SUM(latest_evaluation.planned_capital)
         FILTER (WHERE latest_evaluation.recommendation IN ('buy', 'maybe')
           AND candidate.status <> 'rejected'), 0) AS total_planned_capital,
       COALESCE(SUM(latest_evaluation.projected_profit)
         FILTER (WHERE latest_evaluation.recommendation IN ('buy', 'maybe')
           AND candidate.status <> 'rejected'), 0) AS total_projected_profit
     FROM product_candidates AS candidate
     LEFT JOIN latest_evaluation ON latest_evaluation.candidate_id = candidate.id
     LEFT JOIN latest_sample ON latest_sample.candidate_id = candidate.id
     LEFT JOIN latest_economics ON latest_economics.candidate_id = candidate.id
     WHERE candidate.organization_id = $1`,
    [organizationId],
  );
  const summary = result.rows[0];
  return {
    ...summary,
    settings,
    capital_budget_exceeded: Number(summary.total_planned_capital) > Number(settings.launch_budget),
  };
}

export async function compareCandidates(database, { organizationId, ids }) {
  const result = await database.query(
    `${candidateSelect}
     WHERE candidate.organization_id = $1 AND candidate.id = ANY($2::uuid[])
     ORDER BY candidate.name`,
    [organizationId, ids],
  );
  return result.rows;
}

export async function createCatalogProduct(database, input) {
  const candidateResult = await database.query(
    `SELECT * FROM product_candidates
     WHERE organization_id = $1 AND id = $2 FOR UPDATE`,
    [input.organizationId, input.candidateId],
  );
  const candidate = candidateResult.rows[0] ?? null;
  if (!candidate) return { error: 'not_found' };
  if (candidate.catalog_product_id) return { error: 'duplicate', productId: candidate.catalog_product_id };
  if (candidate.status !== 'approved') return { error: 'not_approved' };

  const references = await database.query(
    `SELECT EXISTS(SELECT 1 FROM categories WHERE id = $1 AND organization_id = $2) AS category_exists,
            ($3::uuid IS NULL OR EXISTS(SELECT 1 FROM brands WHERE id = $3 AND organization_id = $2)) AS brand_exists`,
    [input.categoryId, input.organizationId, input.brandId ?? null],
  );
  if (!references.rows[0].category_exists) return { error: 'category' };
  if (!references.rows[0].brand_exists) return { error: 'brand' };

  const product = await database.query(
    `INSERT INTO products (
       organization_id, brand_id, category_id, name, model_number,
       description, notes, status
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft') RETURNING *`,
    [input.organizationId, input.brandId ?? null, input.categoryId,
      input.productName, input.modelNumber ?? null, input.description ?? null,
      'Created from research candidate ' + candidate.id],
  );
  const variant = await database.query(
    `INSERT INTO product_variants (
       organization_id, product_id, name, attributes, is_active
     ) VALUES ($1, $2, $3, '{}'::jsonb, TRUE) RETURNING *`,
    [input.organizationId, product.rows[0].id, input.variantName],
  );
  const sku = await database.query(
    `INSERT INTO skus (
       organization_id, product_variant_id, sku_code, manufacturer_part_number,
       serial_tracking_enabled, is_active
     ) VALUES ($1, $2, $3, $4, $5, TRUE) RETURNING *`,
    [input.organizationId, variant.rows[0].id, input.skuCode,
      input.manufacturerPartNumber ?? null, input.serialTrackingEnabled],
  );
  await database.query(
    `UPDATE product_candidates SET status = 'launched', catalog_product_id = $1,
       converted_by = $2, converted_at = NOW()
     WHERE id = $3 AND organization_id = $4`,
    [product.rows[0].id, input.userId, input.candidateId, input.organizationId],
  );
  return { candidateId: input.candidateId, product: product.rows[0], variant: variant.rows[0], sku: sku.rows[0] };
}
