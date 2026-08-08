import { pool } from '../config/database.js';
import { paginationMetadata } from '../models/catalogModelHelpers.js';
import * as researchModel from '../models/researchModel.js';
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
  return { ...candidate, snapshots, suppliers, samples, feeAssumptions: fees, economics, evaluations, evidence };
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
    marketplaceUrl: 'marketplace_url', status: 'status', notes: 'notes',
  };
  const changes = {};
  for (const [field, column] of Object.entries(fieldMap)) {
    if (input[field] !== undefined) changes[column] = input[field];
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

export async function listSupplierOptions(organizationId, candidateId) {
  await requireCandidate(pool, organizationId, candidateId);
  return researchModel.listSupplierOptions(pool, { organizationId, candidateId });
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
  };
  const changes = {};
  for (const [field, column] of Object.entries(fieldMap)) {
    if (input[field] !== undefined) changes[column] = input[field];
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
  const fieldMap = {
    supplierOptionId: 'supplier_option_id', referenceCode: 'reference_code',
    orderedAt: 'ordered_at', receivedAt: 'received_at', sampleCost: 'sample_cost',
    currency: 'currency', result: 'result', checklist: 'checklist', notes: 'notes',
  };
  const changes = {};
  for (const [field, column] of Object.entries(fieldMap)) {
    if (input[field] !== undefined) changes[column] = field === 'checklist' ? JSON.stringify(input[field]) : input[field];
  }
  if (input.result !== undefined) {
    changes.evaluated_by = input.result === 'pending' ? null : userId;
    changes.evaluated_at = input.result === 'pending' ? null : new Date();
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
  await requireCandidate(pool, organizationId, candidateId);
  try {
    return await researchModel.calculateAndStoreEconomics(pool, {
      organizationId, candidateId, userId, ...input,
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
