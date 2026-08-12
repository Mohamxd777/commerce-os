import { pool } from '../config/database.js';
import { paginationMetadata } from '../models/catalogModelHelpers.js';
import * as researchModel from '../models/researchModel.js';
import { analyzeNoonUrl } from './noonAnalyzerService.js';
import { AppError } from '../utils/AppError.js';

const transitions = {
  research: new Set(['shortlisted', 'rejected']),
  shortlisted: new Set(['research', 'sourcing', 'rejected']),
  sourcing: new Set(['shortlisted', 'sampling', 'rejected']),
  sampling: new Set(['sourcing', 'approved', 'rejected']),
  approved: new Set(['sampling', 'rejected']),
  rejected: new Set(['research']),
  launched: new Set(),
};

const sampleTransitions = {
  not_requested: new Set(['requested']),
  requested: new Set(['purchased', 'not_requested']),
  purchased: new Set(['testing', 'requested']),
  testing: new Set(['passed', 'failed']),
  passed: new Set(['testing']),
  failed: new Set(['testing', 'requested']),
};

export function normalizeSupplierIdentity(value) {
  return String(value || '').normalize('NFKC').toLocaleLowerCase('en-US')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}

async function addSupplierMatches(database, organizationId, options) {
  const suppliers = await database.query(
    `SELECT id, name, contact_person, phone, email, website_url
     FROM suppliers WHERE organization_id = $1 AND is_active = TRUE ORDER BY name`,
    [organizationId],
  );
  return options.map((option) => {
    if (option.supplier_id || !option.lead_name) return { ...option, identity_matches: [] };
    const key = normalizeSupplierIdentity(option.lead_name);
    return { ...option, identity_matches: suppliers.rows.filter((supplier) => normalizeSupplierIdentity(supplier.name) === key) };
  });
}

async function requireCandidate(database, organizationId, candidateId, forUpdate = false) {
  const candidate = await researchModel.findCandidate(database, {
    organizationId, id: candidateId, forUpdate,
  });
  if (!candidate) {
    throw new AppError(404, 'RESEARCH_CANDIDATE_NOT_FOUND', 'Product candidate not found.');
  }
  return candidate;
}

async function requireCategory(database, organizationId, categoryId) {
  if (!categoryId) return;
  const result = await database.query(
    'SELECT 1 FROM categories WHERE organization_id = $1 AND id = $2',
    [organizationId, categoryId],
  );
  if (result.rowCount === 0) {
    throw new AppError(400, 'RESEARCH_CATEGORY_INVALID', 'Category does not belong to this organization.');
  }
}

async function requireSupplier(database, organizationId, supplierId) {
  if (!supplierId) return;
  const result = await database.query(
    'SELECT 1 FROM suppliers WHERE organization_id = $1 AND id = $2',
    [organizationId, supplierId],
  );
  if (result.rowCount === 0) {
    throw new AppError(400, 'RESEARCH_SUPPLIER_INVALID', 'Supplier does not belong to this organization.');
  }
}

function databaseError(error) {
  if (error instanceof AppError) return error;
  if (error.code === '23505') {
    return new AppError(409, 'RESEARCH_DUPLICATE', 'This research record conflicts with an existing record.');
  }
  if (error.code === '23503' || error.code === '23514') {
    return new AppError(400, 'RESEARCH_REFERENCE_INVALID', 'A research reference or value is invalid.');
  }
  return error;
}

export async function listCandidates(organizationId, query) {
  const result = await researchModel.listCandidates(pool, { organizationId, ...query });
  return {
    items: result.rows,
    pagination: paginationMetadata(result.total, query.page, query.limit),
  };
}

export async function getCandidate(organizationId, id) {
  const candidate = await requireCandidate(pool, organizationId, id);
  const [snapshots, suppliers, samples, fees, economics, evaluations, evidence] = await Promise.all([
    researchModel.listCandidateCollection(pool, {
      table: 'product_candidate_market_snapshots', organizationId, candidateId: id,
      orderBy: 'observed_at DESC, created_at DESC',
    }),
    researchModel.listSupplierOptions(pool, { organizationId, candidateId: id }),
    researchModel.listCandidateCollection(pool, {
      table: 'product_samples', organizationId, candidateId: id,
      orderBy: 'created_at DESC',
    }),
    researchModel.listCandidateCollection(pool, {
      table: 'candidate_fee_assumptions', organizationId, candidateId: id,
      orderBy: 'effective_from DESC, created_at DESC',
    }),
    researchModel.listCandidateCollection(pool, {
      table: 'candidate_unit_economics', organizationId, candidateId: id,
      orderBy: 'created_at DESC',
    }),
    researchModel.listCandidateCollection(pool, {
      table: 'candidate_launch_evaluations', organizationId, candidateId: id,
      orderBy: 'created_at DESC',
    }),
    researchModel.listCandidateCollection(pool, {
      table: 'product_candidate_evidence', organizationId, candidateId: id,
      orderBy: 'created_at DESC',
    }),
  ]);
  return { ...candidate, snapshots, suppliers: await addSupplierMatches(pool, organizationId, suppliers), samples, feeAssumptions: fees, economics, evaluations, evidence };
}

export async function createCandidate(organizationId, userId, input) {
  if (input.status !== 'research') {
    throw new AppError(400, 'RESEARCH_INITIAL_STATUS', 'New candidates must begin in research.');
  }
  await requireCategory(pool, organizationId, input.categoryId);
  try {
    const candidate = await researchModel.createCandidate(pool, { organizationId, userId, ...input });
    return getCandidate(organizationId, candidate.id);
  } catch (error) {
    throw databaseError(error);
  }
}

export async function quickCapture(organizationId, userId, input) {
  const database = await pool.connect();
  try {
    await database.query('BEGIN');
    await requireCategory(database, organizationId, input.categoryId);
    await requireSupplier(database, organizationId, input.supplierId);
    const candidate = await researchModel.createCandidate(database, {
      organizationId,
      userId,
      categoryId: input.categoryId,
      name: input.name,
      brandName: input.brandName,
      modelNumber: input.modelNumber,
      gtin: input.gtin,
      description: input.name,
      status: 'research',
      notes: input.notes,
    });
    await researchModel.createSupplierOption(database, {
      organizationId,
      candidateId: candidate.id,
      supplierId: input.supplierId,
      leadName: input.supplierName,
      quotedUnitCost: input.unitPrice,
      currency: input.currency,
      moq: input.moq,
      leadTimeDays: 0,
      preferred: true,
      modelVariant: input.modelNumber,
      samePriceAllQuantities: true,
      warrantyText: input.warrantyText,
      invoiceAvailable: input.invoiceAvailable,
      notes: input.notes,
    });
    if (input.photoReference) {
      await researchModel.createEvidence(database, {
        organizationId,
        candidateId: candidate.id,
        userId,
        evidenceType: 'url',
        title: 'Quick capture photo reference',
        sourceUrl: input.photoReference,
      });
    }
    await database.query('COMMIT');
    return getCandidate(organizationId, candidate.id);
  } catch (error) {
    await database.query('ROLLBACK');
    throw databaseError(error);
  } finally {
    database.release();
  }
}

export async function patchCandidate(organizationId, id, input) {
  const candidate = await requireCandidate(pool, organizationId, id);
  await requireCategory(pool, organizationId, input.categoryId);
  if (input.status && input.status !== candidate.status && !transitions[candidate.status].has(input.status)) {
    throw new AppError(
      409,
      'RESEARCH_STATUS_TRANSITION_INVALID',
      `Candidate cannot move from ${candidate.status} to ${input.status}.`,
    );
  }
  const fieldMap = {
    categoryId: 'category_id', name: 'name', brandName: 'brand_name',
    marketplaceUrl: 'marketplace_url', description: 'description',
    modelNumber: 'model_number', gtin: 'gtin',
    plannedSellingPrice: 'planned_selling_price',
    plannedPriceCurrency: 'planned_price_currency',
    status: 'status', notes: 'notes',
  };
  const changes = {};
  for (const [field, column] of Object.entries(fieldMap)) {
    if (input[field] !== undefined) changes[column] = input[field];
  }
  const plannedPrice = input.plannedSellingPrice !== undefined
    ? input.plannedSellingPrice : candidate.planned_selling_price;
  const plannedCurrency = input.plannedPriceCurrency !== undefined
    ? input.plannedPriceCurrency : candidate.planned_price_currency;
  if ((plannedPrice === null) !== (plannedCurrency === null)) {
    throw new AppError(400, 'RESEARCH_PLANNED_PRICE_INCOMPLETE', 'Planned selling price and currency must be saved together.');
  }
  try {
    await researchModel.updateCandidate(pool, { organizationId, id, changes });
    return getCandidate(organizationId, id);
  } catch (error) {
    throw databaseError(error);
  }
}

export async function createSnapshot(organizationId, candidateId, userId, input) {
  await requireCandidate(pool, organizationId, candidateId);
  return researchModel.createSnapshot(pool, { organizationId, candidateId, userId, ...input });
}

export function normalizeNoonAnalyzeError(error) {
  if (error?.code === 'NOON_ANALYZE_FAILED') return error;
  const invalidCodes = new Set([
    'INVALID_NOON_URL', 'INVALID_NOON_URL_PROTOCOL', 'NOON_HOST_NOT_ALLOWED',
    'NOON_URL_CREDENTIALS_NOT_ALLOWED', 'NOON_PRIVATE_ADDRESS_BLOCKED',
  ]);
  const unreachableCodes = new Set([
    'NOON_HOST_UNREACHABLE', 'NOON_FETCH_FAILED', 'NOON_REDIRECT_LOOP', 'NOON_REDIRECT_LIMIT',
  ]);
  let reason = 'unexpected';
  if (invalidCodes.has(error?.code)) reason = 'invalid_url';
  else if (error?.code === 'NOON_REQUEST_TIMEOUT') reason = 'timeout';
  else if (unreachableCodes.has(error?.code)) reason = 'unreachable';
  else if (error?.code === 'NOON_BLOCKED') reason = 'blocked';
  else if (error?.code === 'NOON_HTTP_ERROR') {
    if (error.details?.upstreamStatus === 404) reason = 'not_found';
    else if (error.details?.upstreamStatus >= 500) reason = 'upstream_error';
    else reason = 'upstream_error';
  } else if (['NOON_EXTRACTION_FAILED', 'NOON_UNEXPECTED_CONTENT', 'NOON_RESPONSE_TOO_LARGE'].includes(error?.code)) {
    reason = 'extraction';
  }
  const statusCode = error instanceof AppError ? error.statusCode : 500;
  const details = { reason, causeCode: error?.code || 'UNEXPECTED_ERROR' };
  if (Number.isInteger(error?.details?.upstreamStatus)) {
    details.upstreamStatus = error.details.upstreamStatus;
  }
  return new AppError(statusCode, 'NOON_ANALYZE_FAILED', 'Could not analyze this Noon page.', details);
}

export async function analyzeNoon(url) {
  try {
    return await analyzeNoonUrl(url);
  } catch (error) {
    throw normalizeNoonAnalyzeError(error);
  }
}

export async function listSupplierOptions(organizationId, candidateId) {
  await requireCandidate(pool, organizationId, candidateId);
  const options = await researchModel.listSupplierOptions(pool, { organizationId, candidateId });
  return addSupplierMatches(pool, organizationId, options);
}

export async function createSupplierOption(organizationId, candidateId, input) {
  await requireCandidate(pool, organizationId, candidateId);
  await requireSupplier(pool, organizationId, input.supplierId);
  try {
    return await researchModel.createSupplierOption(pool, { organizationId, candidateId, ...input });
  } catch (error) {
    throw databaseError(error);
  }
}

export async function patchSupplierOption(organizationId, id, input) {
  const existing = await researchModel.findSupplierOption(pool, { organizationId, id });
  if (!existing) throw new AppError(404, 'RESEARCH_SUPPLIER_OPTION_NOT_FOUND', 'Supplier option not found.');
  const supplierId = input.supplierId !== undefined ? input.supplierId : existing.supplier_id;
  const leadName = input.leadName !== undefined ? input.leadName : existing.lead_name;
  if (!supplierId && !leadName) {
    throw new AppError(400, 'RESEARCH_SUPPLIER_REQUIRED', 'Choose a supplier or enter a supplier lead.');
  }
  await requireSupplier(pool, organizationId, input.supplierId);
  const fieldMap = {
    supplierId: 'supplier_id', leadName: 'lead_name', contactUrl: 'contact_url',
    quotedUnitCost: 'quoted_unit_cost', currency: 'currency', moq: 'moq',
    leadTimeDays: 'lead_time_days', quoteDate: 'quote_date',
    quoteValidUntil: 'quote_valid_until', preferred: 'preferred', notes: 'notes',
    modelVariant: 'model_variant', samePriceAllQuantities: 'same_price_all_quantities',
    priceQty1: 'price_qty_1', priceQty5: 'price_qty_5',
    priceQty10: 'price_qty_10', priceQty20: 'price_qty_20',
    priceQty50: 'price_qty_50', priceQty100: 'price_qty_100',
    warrantyText: 'warranty_text', defectiveUnitReplacement: 'defective_unit_replacement',
    invoiceAvailable: 'invoice_available', sampleAvailable: 'sample_available',
    contactPerson: 'contact_person', phone: 'phone',
  };
  const changes = {};
  for (const [field, column] of Object.entries(fieldMap)) {
    if (input[field] !== undefined) changes[column] = input[field];
  }
  if (input.samePriceAllQuantities === true) {
    for (const column of ['price_qty_1', 'price_qty_5', 'price_qty_10', 'price_qty_20', 'price_qty_50', 'price_qty_100']) {
      changes[column] = null;
    }
  }
  try {
    return await researchModel.updateSupplierOption(pool, {
      organizationId, id, candidateId: existing.candidate_id, changes,
    });
  } catch (error) {
    throw databaseError(error);
  }
}

export async function listSamples(organizationId, candidateId) {
  await requireCandidate(pool, organizationId, candidateId);
  return researchModel.listCandidateCollection(pool, {
    table: 'product_samples', organizationId, candidateId, orderBy: 'created_at DESC',
  });
}

async function requireCandidateSupplierOption(organizationId, candidateId, optionId) {
  if (!optionId) return;
  const option = await researchModel.findSupplierOption(pool, { organizationId, id: optionId });
  if (!option || option.candidate_id !== candidateId) {
    throw new AppError(400, 'RESEARCH_SAMPLE_SUPPLIER_INVALID', 'Supplier option does not belong to this candidate.');
  }
}

export async function createSample(organizationId, candidateId, userId, input) {
  await requireCandidate(pool, organizationId, candidateId);
  await requireCandidateSupplierOption(organizationId, candidateId, input.supplierOptionId);
  return researchModel.createSample(pool, { organizationId, candidateId, userId, ...input });
}

export async function patchSample(organizationId, id, userId, input) {
  const sample = await researchModel.findSample(pool, { organizationId, id });
  if (!sample) throw new AppError(404, 'RESEARCH_SAMPLE_NOT_FOUND', 'Sample not found.');
  await requireCandidateSupplierOption(organizationId, sample.candidate_id, input.supplierOptionId);
  const requestedState = input.workflowState
    ?? (input.result === 'pass' ? 'passed' : input.result === 'fail' ? 'failed' : undefined);
  if (requestedState && requestedState !== sample.workflow_state
    && !sampleTransitions[sample.workflow_state].has(requestedState)) {
    throw new AppError(
      409,
      'RESEARCH_SAMPLE_TRANSITION_INVALID',
      `Sample cannot move from ${sample.workflow_state} to ${requestedState}.`,
    );
  }
  const fieldMap = {
    supplierOptionId: 'supplier_option_id', referenceCode: 'reference_code',
    orderedAt: 'ordered_at', receivedAt: 'received_at', sampleCost: 'sample_cost',
    currency: 'currency', result: 'result', workflowState: 'workflow_state',
    checklist: 'checklist', notes: 'notes',
  };
  const changes = {};
  for (const [field, column] of Object.entries(fieldMap)) {
    if (input[field] !== undefined) changes[column] = field === 'checklist' ? JSON.stringify(input[field]) : input[field];
  }
  if (input.result !== undefined) {
    changes.evaluated_by = input.result === 'pending' ? null : userId;
    changes.evaluated_at = input.result === 'pending' ? null : new Date();
  }
  if (input.workflowState !== undefined) {
    const terminal = input.workflowState === 'passed' || input.workflowState === 'failed';
    changes.result = input.workflowState === 'passed' ? 'pass' : input.workflowState === 'failed' ? 'fail' : 'pending';
    changes.evaluated_by = terminal ? userId : null;
    changes.evaluated_at = terminal ? new Date() : null;
  }
  try {
    return await researchModel.updateSample(pool, { organizationId, id, changes });
  } catch (error) {
    throw databaseError(error);
  }
}

export async function createFeeAssumption(organizationId, candidateId, userId, input) {
  await requireCandidate(pool, organizationId, candidateId);
  return researchModel.createFeeAssumption(pool, { organizationId, candidateId, userId, ...input });
}

export async function createEvidence(organizationId, candidateId, userId, input) {
  await requireCandidate(pool, organizationId, candidateId);
  return researchModel.createEvidence(pool, { organizationId, candidateId, userId, ...input });
}

export async function calculateEconomics(organizationId, candidateId, userId, input) {
  const candidate = await requireCandidate(pool, organizationId, candidateId);
  let authoritativeInput = input;
  if (input.supplierOptionId) {
    const option = await researchModel.findSupplierOption(pool, {
      organizationId, id: input.supplierOptionId,
    });
    if (!option || option.candidate_id !== candidateId) {
      throw new AppError(400, 'RESEARCH_ECONOMICS_SUPPLIER_INVALID', 'Selected supplier option does not belong to this candidate.');
    }
    authoritativeInput = {
      ...input,
      supplierUnitCost: option.quoted_unit_cost,
      sellingPrice: candidate.planned_selling_price ?? input.sellingPrice,
      currency: candidate.planned_price_currency ?? input.currency,
    };
  }
  try {
    return await researchModel.calculateAndStoreEconomics(pool, {
      organizationId, candidateId, userId, ...authoritativeInput,
    });
  } catch (error) {
    throw databaseError(error);
  }
}

export async function createEvaluation(organizationId, candidateId, userId, input) {
  await requireCandidate(pool, organizationId, candidateId);
  if (input.unitEconomicsId) {
    const result = await pool.query(
      `SELECT 1 FROM candidate_unit_economics
       WHERE organization_id = $1 AND candidate_id = $2 AND id = $3`,
      [organizationId, candidateId, input.unitEconomicsId],
    );
    if (result.rowCount === 0) {
      throw new AppError(400, 'RESEARCH_ECONOMICS_INVALID', 'Unit economics does not belong to this candidate.');
    }
  }
  return researchModel.createEvaluation(pool, { organizationId, candidateId, userId, ...input });
}

export function getComparison(organizationId, ids) {
  return researchModel.compareCandidates(pool, { organizationId, ids });
}

export function getSummary(organizationId) {
  return researchModel.getSummary(pool, { organizationId });
}

export function getSettings(organizationId) {
  return researchModel.getSettings(pool, { organizationId });
}

export async function patchSettings(organizationId, userId, input) {
  const settings = await researchModel.getSettings(pool, { organizationId });
  const fieldMap = {
    minimumMarginPercentage: 'minimum_margin_percentage',
    minimumRoiPercentage: 'minimum_roi_percentage',
    maximumCapitalAllocation: 'maximum_capital_allocation',
    maximumDefectRisk: 'maximum_defect_risk',
    minimumDemandScore: 'minimum_demand_score',
    launchBudget: 'launch_budget', currency: 'currency',
  };
  const changes = { updated_by: userId };
  for (const [field, column] of Object.entries(fieldMap)) {
    if (input[field] !== undefined) changes[column] = input[field];
  }
  return researchModel.updateSettings(pool, {
    organizationId, id: settings.id, changes,
  });
}

export async function createProductFromCandidate(organizationId, candidateId, userId, input) {
  const database = await pool.connect();
  try {
    await database.query('BEGIN');
    const result = await researchModel.createCatalogProduct(database, {
      organizationId, candidateId, userId, ...input,
    });
    if (result.error === 'not_found') throw new AppError(404, 'RESEARCH_CANDIDATE_NOT_FOUND', 'Product candidate not found.');
    if (result.error === 'duplicate') throw new AppError(409, 'RESEARCH_PRODUCT_ALREADY_CREATED', 'This candidate has already been converted.');
    if (result.error === 'not_approved') throw new AppError(409, 'RESEARCH_CANDIDATE_NOT_APPROVED', 'Approve the candidate before creating a product.');
    if (result.error === 'category') throw new AppError(400, 'RESEARCH_CATEGORY_INVALID', 'Category does not belong to this organization.');
    if (result.error === 'brand') throw new AppError(400, 'RESEARCH_BRAND_INVALID', 'Brand does not belong to this organization.');
    await database.query('COMMIT');
    return result;
  } catch (error) {
    await database.query('ROLLBACK');
    if (error.code === '23505') {
      throw new AppError(409, 'RESEARCH_PRODUCT_CONFLICT', 'The SKU or product conversion already exists.');
    }
    throw databaseError(error);
  } finally {
    database.release();
  }
}

export async function promoteSupplierOption(organizationId, optionId, userId, input) {
  const database = await pool.connect();
  try {
    await database.query('BEGIN');
    const optionResult = await database.query(
      `SELECT option.*, candidate.status AS candidate_status,
              (SELECT sku.id FROM product_variants AS variant
               JOIN skus AS sku ON sku.product_variant_id = variant.id
                 AND sku.organization_id = variant.organization_id
               WHERE variant.product_id = candidate.catalog_product_id
                 AND variant.organization_id = candidate.organization_id
               ORDER BY sku.created_at, sku.id LIMIT 1) AS converted_sku_id
       FROM candidate_supplier_options AS option
       JOIN product_candidates AS candidate
         ON candidate.id = option.candidate_id AND candidate.organization_id = option.organization_id
       WHERE option.organization_id = $1 AND option.id = $2
       FOR UPDATE OF option`,
      [organizationId, optionId],
    );
    const option = optionResult.rows[0];
    if (!option) throw new AppError(404, 'RESEARCH_SUPPLIER_OPTION_NOT_FOUND', 'Supplier option not found.');
    if (input.action === 'keep_lead') {
      await database.query('COMMIT');
      return { action: 'keep_lead', supplierOptionId: option.id, linked: false, purchaseOrderCreated: false, inventoryChanged: false };
    }

    let supplier;
    if (input.action === 'use_existing') {
      const supplierResult = await database.query(
        `SELECT * FROM suppliers WHERE organization_id = $1 AND id = $2 AND is_active = TRUE`,
        [organizationId, input.supplierId],
      );
      supplier = supplierResult.rows[0];
      if (!supplier) throw new AppError(400, 'RESEARCH_SUPPLIER_INVALID', 'Supplier does not belong to this organization.');
    } else {
      if (!option.lead_name) throw new AppError(409, 'RESEARCH_LEAD_NAME_REQUIRED', 'This option does not contain a supplier lead to create.');
      const activeSuppliers = await database.query(
        `SELECT id, name FROM suppliers WHERE organization_id = $1 AND is_active = TRUE ORDER BY name`,
        [organizationId],
      );
      const key = normalizeSupplierIdentity(option.lead_name);
      const matches = activeSuppliers.rows.filter((item) => normalizeSupplierIdentity(item.name) === key);
      if (matches.length) {
        throw new AppError(409, 'RESEARCH_SUPPLIER_MATCH_EXISTS', 'A matching supplier already exists. Explicitly choose that supplier or keep this as a research lead.', { matches });
      }
      const created = await database.query(
        `INSERT INTO suppliers (
           organization_id, name, contact_person, phone, website_url,
           notes, preferred_currency, is_active
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE) RETURNING *`,
        [organizationId, option.lead_name, option.contact_person, option.phone,
          option.contact_url, 'Created explicitly from research supplier option ' + option.id,
          option.currency],
      );
      supplier = created.rows[0];
    }

    await database.query(
      `UPDATE candidate_supplier_options
       SET supplier_id = $1, supplier_linked_at = NOW(), updated_at = NOW()
       WHERE organization_id = $2 AND id = $3`,
      [supplier.id, organizationId, option.id],
    );

    let relationship = null;
    let relationshipCreated = false;
    if (input.linkToConvertedSku) {
      if (option.candidate_status !== 'launched' || !option.converted_sku_id) {
        throw new AppError(409, 'RESEARCH_SKU_NOT_CONVERTED', 'Create the draft SKU before linking its supplier.');
      }
      const existing = await database.query(
        `SELECT * FROM supplier_products
         WHERE organization_id = $1 AND supplier_id = $2 AND sku_id = $3 AND is_active = TRUE`,
        [organizationId, supplier.id, option.converted_sku_id],
      );
      if (existing.rowCount > 0) {
        relationship = existing.rows[0];
        if (input.preferred) {
          await database.query(
            `UPDATE supplier_products SET preferred = FALSE, updated_at = NOW()
             WHERE organization_id = $1 AND sku_id = $2 AND id <> $3
               AND preferred = TRUE AND is_active = TRUE`,
            [organizationId, option.converted_sku_id, relationship.id],
          );
        }
        await database.query(
          `UPDATE supplier_products SET
             research_supplier_option_id = COALESCE(research_supplier_option_id, $1),
             warranty_text = COALESCE(warranty_text, $2),
             defective_unit_replacement = COALESCE(defective_unit_replacement, $3),
             last_quote_date = GREATEST(last_quote_date, $4::date),
             preferred = CASE WHEN $5 THEN TRUE ELSE preferred END,
             updated_at = NOW()
           WHERE id = $6`,
          [option.id, option.warranty_text, option.defective_unit_replacement,
            option.quote_date, input.preferred, relationship.id],
        );
        relationship = (await database.query('SELECT * FROM supplier_products WHERE id = $1', [relationship.id])).rows[0];
      } else {
        if (input.preferred) {
          await database.query(
            `UPDATE supplier_products SET preferred = FALSE, updated_at = NOW()
             WHERE organization_id = $1 AND sku_id = $2 AND preferred = TRUE AND is_active = TRUE`,
            [organizationId, option.converted_sku_id],
          );
        }
        const sample = await database.query(
          `SELECT id FROM product_samples
           WHERE organization_id = $1 AND supplier_option_id = $2
           ORDER BY CASE workflow_state WHEN 'passed' THEN 0 ELSE 1 END, created_at DESC LIMIT 1`,
          [organizationId, option.id],
        );
        const inserted = await database.query(
          `INSERT INTO supplier_products (
             organization_id, supplier_id, sku_id, supplier_sku_code,
             current_unit_cost, currency, moq, lead_time_days, preferred,
             is_active, notes, warranty_text, defective_unit_replacement,
             last_quote_date, research_supplier_option_id, sample_id
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, $10, $11, $12, $13, $14, $15)
           RETURNING *`,
          [organizationId, supplier.id, option.converted_sku_id,
            option.model_variant?.slice(0, 120) || null, option.quoted_unit_cost,
            option.currency, option.moq, option.lead_time_days, input.preferred,
            option.notes, option.warranty_text, option.defective_unit_replacement,
            option.quote_date, option.id, sample.rows[0]?.id ?? null],
        );
        relationship = inserted.rows[0];
        relationshipCreated = true;
        await database.query(
          `INSERT INTO supplier_price_history (
             organization_id, supplier_product_id, unit_cost, currency,
             effective_from, source, notes
           ) VALUES ($1, $2, $3, $4, COALESCE($5::date, CURRENT_DATE), $6, $7)`,
          [organizationId, relationship.id, option.quoted_unit_cost, option.currency,
            option.quote_date, 'Research supplier option', 'Linked explicitly by user ' + userId],
        );
      }
    }
    await database.query('COMMIT');
    return {
      action: input.action, supplier, supplierOptionId: option.id,
      relationship, relationshipCreated, purchaseOrderCreated: false, inventoryChanged: false,
    };
  } catch (error) {
    await database.query('ROLLBACK');
    throw databaseError(error);
  } finally {
    database.release();
  }
}
