import { z } from 'zod';

const uuid = z.string().uuid('A valid UUID is required.');
const url = z.string().trim().url().max(1000);
const optionalText = (maximum) => z.string().trim().min(1).max(maximum).nullable().optional();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.');
const isoDateTime = z.string().datetime({ offset: true });
const currency = z.string().trim().regex(/^[A-Za-z]{3}$/).transform((value) => value.toUpperCase());

function requestSchema({ body, params, query }) {
  return z.object({
    body: body ?? z.object({}).optional(),
    params: params ?? z.record(z.string(), z.string()).optional(),
    query: query ?? z.record(z.string(), z.unknown()).optional(),
  });
}

function decimal({ positive = false, maximum = 15 } = {}) {
  return z.union([z.string(), z.number().finite().nonnegative()])
    .transform((value) => String(value).trim())
    .refine(
      (value) => new RegExp('^\\d{1,' + maximum + '}(?:\\.\\d{1,4})?$').test(value),
      'Use a non-negative decimal with at most 4 decimal places.',
    )
    .refine(
      (value) => !positive || !/^0+(?:\.0+)?$/.test(value),
      'The value must be greater than zero.',
    );
}

function nonEmptyPatch(schema) {
  return schema.refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided.',
  });
}

const nonNegativeDecimal = decimal();
const positiveDecimal = decimal({ positive: true });
const percentage = decimal({ maximum: 3 }).refine((value) => Number(value) <= 100, 'Must be at most 100.');
const score = z.coerce.number().int().min(1).max(5);
const candidateStatus = z.enum(['research', 'shortlisted', 'sourcing', 'sampling', 'approved', 'rejected', 'launched']);
const sampleWorkflowState = z.enum(['not_requested', 'requested', 'purchased', 'testing', 'passed', 'failed']);
const pageQuery = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
};

export const researchIdSchema = requestSchema({
  params: z.object({ id: uuid }).strict(),
});

export const noonAnalyzeSchema = requestSchema({
  body: z.object({ url }).strict(),
});

export const candidateListSchema = requestSchema({
  query: z.object({
    ...pageQuery,
    search: z.string().trim().max(200).optional(),
    status: candidateStatus.optional(),
    categoryId: uuid.optional(),
    decision: z.enum(['buy', 'maybe', 'reject', 'needs_more_research']).optional(),
    risk: z.enum(['low', 'medium', 'high']).optional(),
    supplier: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
    supplierId: uuid.optional(),
    sample: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
  }).strict(),
});

const candidateFields = {
  categoryId: uuid.nullable().optional(),
  name: z.string().trim().min(1).max(200),
  brandName: optionalText(160),
  marketplaceUrl: url.nullable().optional(),
  description: optionalText(10_000),
  modelNumber: optionalText(120),
  gtin: z.string().trim().regex(/^\d{8,14}$/, 'Use an 8 to 14 digit GTIN/barcode.').nullable().optional(),
  plannedSellingPrice: positiveDecimal.nullable().optional(),
  plannedPriceCurrency: currency.nullable().optional(),
  status: candidateStatus,
  notes: optionalText(10_000),
};

function validatePlannedPrice(value, context) {
  const hasPrice = value.plannedSellingPrice !== undefined && value.plannedSellingPrice !== null;
  const hasCurrency = value.plannedPriceCurrency !== undefined && value.plannedPriceCurrency !== null;
  if (hasPrice !== hasCurrency) {
    context.addIssue({ code: 'custom', path: ['plannedSellingPrice'], message: 'Planned price and currency must be provided together.' });
  }
}

export const candidateCreateSchema = requestSchema({
  body: z.object({
    ...candidateFields,
    categoryId: uuid.nullable().optional(),
    status: candidateStatus.default('research'),
  }).strict().superRefine(validatePlannedPrice),
});

export const candidatePatchSchema = requestSchema({
  params: z.object({ id: uuid }).strict(),
  body: nonEmptyPatch(z.object({
    categoryId: candidateFields.categoryId,
    name: candidateFields.name.optional(),
    brandName: candidateFields.brandName,
    marketplaceUrl: candidateFields.marketplaceUrl,
    description: candidateFields.description,
    modelNumber: candidateFields.modelNumber,
    gtin: candidateFields.gtin,
    plannedSellingPrice: candidateFields.plannedSellingPrice,
    plannedPriceCurrency: candidateFields.plannedPriceCurrency,
    status: candidateStatus.optional(),
    notes: candidateFields.notes,
  }).strict()),
});

export const quickCaptureCreateSchema = requestSchema({
  body: z.object({
    name: z.string().trim().min(1).max(200),
    supplierId: uuid.nullable().optional(),
    supplierName: optionalText(200),
    unitPrice: nonNegativeDecimal,
    currency: currency.default('EGP'),
    brandName: optionalText(160),
    modelNumber: optionalText(120),
    gtin: z.string().trim().regex(/^\d{8,14}$/, 'Use an 8 to 14 digit GTIN/barcode.').nullable().optional(),
    categoryId: uuid.nullable().optional(),
    moq: positiveDecimal.default('1'),
    warrantyText: optionalText(500),
    invoiceAvailable: z.boolean().nullable().optional(),
    notes: optionalText(10_000),
    photoReference: url.nullable().optional(),
  }).strict().superRefine((value, context) => {
    if (!value.supplierId && !value.supplierName) {
      context.addIssue({ code: 'custom', path: ['supplierName'], message: 'Choose a supplier or enter its name.' });
    }
  }),
});

export const snapshotCreateSchema = requestSchema({
  params: z.object({ id: uuid }).strict(),
  body: z.object({
    marketplace: z.string().trim().min(1).max(100),
    listingUrl: url,
    observedAt: isoDateTime.optional(),
    sellingPrice: nonNegativeDecimal.nullable().optional(),
    currency: currency.nullable().optional(),
    rating: z.union([z.string(), z.number()]).transform(Number).refine((value) => value >= 0 && value <= 5).optional(),
    reviewCount: z.coerce.number().int().min(0).optional(),
    demandScore: score.optional(),
    competitionScore: score.optional(),
    evidenceNotes: optionalText(10_000),
    listingTitle: optionalText(500),
    sellerBrand: optionalText(200),
    originalPrice: nonNegativeDecimal.nullable().optional(),
    recentSalesSignal: optionalText(240),
    bestsellerRankText: optionalText(240),
    fulfillmentBadge: optionalText(120),
    canonicalUrl: url.nullable().optional(),
    availability: optionalText(120),
    keySpecifications: z.record(z.string().trim().min(1).max(200), z.string().trim().max(2000)).default({}),
    modelNumber: optionalText(160),
    gtin: z.string().trim().regex(/^\d{8,14}$/, 'Use an 8 to 14 digit GTIN/barcode.').nullable().optional(),
    mainImageUrl: url.nullable().optional(),
    analyzedAt: isoDateTime.nullable().optional(),
    extractionMetadata: z.record(z.string(), z.unknown()).default({}),
  }).strict(),
});

const supplierOptionFields = {
  supplierId: uuid.nullable().optional(),
  leadName: optionalText(200),
  contactUrl: url.nullable().optional(),
  quotedUnitCost: nonNegativeDecimal,
  currency,
  moq: positiveDecimal,
  leadTimeDays: z.coerce.number().int().min(0).max(3650),
  quoteDate: isoDate.nullable().optional(),
  quoteValidUntil: isoDate.nullable().optional(),
  preferred: z.boolean(),
  notes: optionalText(10_000),
  modelVariant: optionalText(200),
  samePriceAllQuantities: z.boolean().default(true),
  priceQty1: nonNegativeDecimal.nullable().optional(),
  priceQty5: nonNegativeDecimal.nullable().optional(),
  priceQty10: nonNegativeDecimal.nullable().optional(),
  priceQty20: nonNegativeDecimal.nullable().optional(),
  priceQty50: nonNegativeDecimal.nullable().optional(),
  priceQty100: nonNegativeDecimal.nullable().optional(),
  warrantyText: optionalText(500),
  defectiveUnitReplacement: z.boolean().nullable().optional(),
  invoiceAvailable: z.boolean().nullable().optional(),
  sampleAvailable: z.boolean().nullable().optional(),
  contactPerson: optionalText(200),
  phone: optionalText(80),
};

function validateSupplierOption(value, context) {
  if (!value.supplierId && !value.leadName) {
    context.addIssue({ code: 'custom', path: ['leadName'], message: 'Choose an existing supplier or enter a supplier lead.' });
  }
  if (value.quoteDate && value.quoteValidUntil && value.quoteValidUntil < value.quoteDate) {
    context.addIssue({ code: 'custom', path: ['quoteValidUntil'], message: 'Quote validity cannot end before the quote date.' });
  }
}

export const supplierOptionCreateSchema = requestSchema({
  params: z.object({ id: uuid }).strict(),
  body: z.object(supplierOptionFields).strict().superRefine(validateSupplierOption),
});

export const supplierOptionPatchSchema = requestSchema({
  params: z.object({ id: uuid }).strict(),
  body: nonEmptyPatch(z.object({
    supplierId: supplierOptionFields.supplierId,
    leadName: supplierOptionFields.leadName,
    contactUrl: supplierOptionFields.contactUrl,
    quotedUnitCost: nonNegativeDecimal.optional(),
    currency: currency.optional(),
    moq: positiveDecimal.optional(),
    leadTimeDays: supplierOptionFields.leadTimeDays.optional(),
    quoteDate: supplierOptionFields.quoteDate,
    quoteValidUntil: supplierOptionFields.quoteValidUntil,
    preferred: z.boolean().optional(),
    notes: supplierOptionFields.notes,
    modelVariant: supplierOptionFields.modelVariant,
    samePriceAllQuantities: z.boolean().optional(),
    priceQty1: supplierOptionFields.priceQty1,
    priceQty5: supplierOptionFields.priceQty5,
    priceQty10: supplierOptionFields.priceQty10,
    priceQty20: supplierOptionFields.priceQty20,
    priceQty50: supplierOptionFields.priceQty50,
    priceQty100: supplierOptionFields.priceQty100,
    warrantyText: supplierOptionFields.warrantyText,
    defectiveUnitReplacement: supplierOptionFields.defectiveUnitReplacement,
    invoiceAvailable: supplierOptionFields.invoiceAvailable,
    sampleAvailable: supplierOptionFields.sampleAvailable,
    contactPerson: supplierOptionFields.contactPerson,
    phone: supplierOptionFields.phone,
  }).strict()),
});

export const supplierPromotionSchema = requestSchema({
  params: z.object({ id: uuid }).strict(),
  body: z.object({
    action: z.enum(['use_existing', 'create_supplier', 'keep_lead']),
    supplierId: uuid.optional(),
    linkToConvertedSku: z.boolean().default(false),
    preferred: z.boolean().default(false),
  }).strict().superRefine((value, context) => {
    if (value.action === 'use_existing' && !value.supplierId) {
      context.addIssue({ code: 'custom', path: ['supplierId'], message: 'Choose the existing supplier to use.' });
    }
  }),
});

const checklistItem = z.object({
  label: z.string().trim().min(1).max(240),
  passed: z.boolean().nullable().default(null),
  score: score.nullable().optional(),
  notes: optionalText(2000),
}).strict();

const sampleFields = {
  supplierOptionId: uuid.nullable().optional(),
  referenceCode: optionalText(100),
  orderedAt: isoDate.nullable().optional(),
  receivedAt: isoDate.nullable().optional(),
  sampleCost: nonNegativeDecimal.nullable().optional(),
  currency: currency.nullable().optional(),
  result: z.enum(['pending', 'pass', 'fail', 'retest']),
  workflowState: sampleWorkflowState.optional(),
  checklist: z.array(checklistItem).max(100),
  notes: optionalText(10_000),
};

export const sampleCreateSchema = requestSchema({
  params: z.object({ id: uuid }).strict(),
  body: z.object({ ...sampleFields, result: sampleFields.result.default('pending'), checklist: sampleFields.checklist.default([]) }).strict(),
});

export const samplePatchSchema = requestSchema({
  params: z.object({ id: uuid }).strict(),
  body: nonEmptyPatch(z.object({
    supplierOptionId: sampleFields.supplierOptionId,
    referenceCode: sampleFields.referenceCode,
    orderedAt: sampleFields.orderedAt,
    receivedAt: sampleFields.receivedAt,
    sampleCost: sampleFields.sampleCost,
    currency: sampleFields.currency,
    result: sampleFields.result.optional(),
    workflowState: sampleWorkflowState.optional(),
    checklist: sampleFields.checklist.optional(),
    notes: sampleFields.notes,
  }).strict()),
});

export const economicsCreateSchema = requestSchema({
  params: z.object({ id: uuid }).strict(),
  body: z.object({
    supplierOptionId: uuid.nullable().optional(),
    currency,
    sellingPrice: positiveDecimal,
    supplierUnitCost: nonNegativeDecimal,
    localTransportCost: nonNegativeDecimal.default('0'),
    packagingCost: nonNegativeDecimal.default('0'),
    referralFeePercentage: percentage.default('0').refine((value) => Number(value) < 100, 'Must be less than 100.'),
    referralFeeFixed: nonNegativeDecimal.default('0'),
    fulfillmentFee: nonNegativeDecimal.default('0'),
    shippingReimbursement: nonNegativeDecimal.default('0'),
    advertisingCost: nonNegativeDecimal.default('0'),
    estimatedReturnReserve: nonNegativeDecimal.default('0'),
    otherVariableCosts: nonNegativeDecimal.default('0'),
    targetMarginPercentage: percentage.nullable().optional(),
    targetRoiPercentage: nonNegativeDecimal.nullable().optional(),
  }).strict(),
});

export const evaluationCreateSchema = requestSchema({
  params: z.object({ id: uuid }).strict(),
  body: z.object({
    unitEconomicsId: uuid.nullable().optional(),
    recommendation: z.enum(['buy', 'maybe', 'reject', 'needs_more_research']),
    riskLevel: z.enum(['low', 'medium', 'high']),
    targetSellingPrice: positiveDecimal,
    targetUnitCost: nonNegativeDecimal,
    targetMarginPercentage: z.union([z.string(), z.number().finite()]).transform(String),
    targetRoiPercentage: z.union([z.string(), z.number().finite()]).transform(String),
    launchQuantity: positiveDecimal,
    plannedCapital: nonNegativeDecimal,
    projectedProfit: z.union([z.string(), z.number().finite()]).transform(String),
    rationale: z.string().trim().min(3).max(10_000),
  }).strict(),
});

export const comparisonSchema = requestSchema({
  query: z.object({ ids: z.string().trim().min(1).transform((value, context) => {
    const ids = [...new Set(value.split(',').map((id) => id.trim()).filter(Boolean))];
    if (ids.length < 2 || ids.length > 10 || ids.some((id) => !z.string().uuid().safeParse(id).success)) {
      context.addIssue({ code: 'custom', message: 'Choose 2 to 10 valid candidate IDs.' });
      return z.NEVER;
    }
    return ids;
  }) }).strict(),
});

export const researchSummarySchema = requestSchema({ query: z.object({}).strict() });

export const settingsPatchSchema = requestSchema({
  body: nonEmptyPatch(z.object({
    minimumMarginPercentage: percentage.optional(),
    minimumRoiPercentage: nonNegativeDecimal.optional(),
    maximumCapitalAllocation: nonNegativeDecimal.optional(),
    maximumDefectRisk: z.enum(['low', 'medium', 'high']).optional(),
    minimumDemandScore: score.optional(),
    launchBudget: nonNegativeDecimal.optional(),
    currency: currency.optional(),
  }).strict()),
});

export const feeAssumptionCreateSchema = requestSchema({
  params: z.object({ id: uuid }).strict(),
  body: z.object({
    feeName: z.string().trim().min(1).max(160),
    feeType: z.enum(['percentage', 'fixed']),
    feeValue: nonNegativeDecimal,
    currency: currency.nullable().optional(),
    effectiveFrom: isoDate,
    effectiveTo: isoDate.nullable().optional(),
    sourceUrl: url.nullable().optional(),
    notes: optionalText(10_000),
  }).strict().superRefine((value, context) => {
    if (value.feeType === 'percentage' && Number(value.feeValue) > 100) {
      context.addIssue({ code: 'custom', path: ['feeValue'], message: 'Percentage fee cannot exceed 100.' });
    }
    if (value.effectiveTo && value.effectiveTo < value.effectiveFrom) {
      context.addIssue({ code: 'custom', path: ['effectiveTo'], message: 'Effective end cannot precede the start.' });
    }
  }),
});

export const evidenceCreateSchema = requestSchema({
  params: z.object({ id: uuid }).strict(),
  body: z.object({
    evidenceType: z.enum(['url', 'file', 'screenshot']),
    title: z.string().trim().min(1).max(240),
    sourceUrl: url.nullable().optional(),
    storageKey: optionalText(500),
    originalFilename: optionalText(255),
    mediaType: optionalText(120),
    notes: optionalText(10_000),
  }).strict().refine((value) => value.sourceUrl || value.storageKey, {
    message: 'Evidence requires a URL or external storage key.',
  }),
});

export const createProductFromCandidateSchema = requestSchema({
  params: z.object({ id: uuid }).strict(),
  body: z.object({
    categoryId: uuid,
    brandId: uuid.nullable().optional(),
    productName: z.string().trim().min(1).max(200),
    modelNumber: optionalText(120),
    description: optionalText(10_000),
    variantName: z.string().trim().min(1).max(160),
    skuCode: z.string().trim().min(3).max(64).transform((value) => value.toUpperCase())
      .refine((value) => /^[A-Z0-9][A-Z0-9._/-]{2,63}$/.test(value), 'Use letters, numbers, dots, underscores, slashes, or hyphens.'),
    manufacturerPartNumber: optionalText(160),
    serialTrackingEnabled: z.boolean().default(false),
  }).strict(),
});
