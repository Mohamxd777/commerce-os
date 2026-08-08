import { z } from 'zod';

const uuid = z.string().uuid('A valid UUID is required.');
const optionalText = (maximum) => z.string().trim().min(1).max(maximum).nullable().optional();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.');
const isoDateTime = z.string().datetime({ offset: true });
const stockBucket = z.enum(['available', 'reserved', 'quarantine', 'damaged']);
const movementType = z.enum([
  'PURCHASE_RECEIPT',
  'TRANSFER_OUT',
  'TRANSFER_IN',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
  'DAMAGE',
  'QUARANTINE_IN',
  'QUARANTINE_OUT',
  'RELEASE_FROM_QUARANTINE',
  'RESERVATION',
  'RESERVATION_RELEASE',
  'SALE',
  'SALE_RETURN',
]);

function requestSchema({ body, params, query }) {
  return z.object({
    body: body ?? z.object({}).optional(),
    params: params ?? z.record(z.string(), z.string()).optional(),
    query: query ?? z.record(z.string(), z.unknown()).optional(),
  });
}

function nonEmptyPatch(schema) {
  return schema.refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided.',
  });
}

function decimal({ positive = false } = {}) {
  return z
    .union([z.string(), z.number().finite().nonnegative()])
    .transform((value) => String(value).trim())
    .refine(
      (value) => /^\d{1,15}(?:\.\d{1,4})?$/.test(value),
      'Use a non-negative decimal with at most 4 decimal places.',
    )
    .refine(
      (value) => !positive || !/^0+(?:\.0+)?$/.test(value),
      'The value must be greater than zero.',
    );
}

const nonNegativeDecimal = decimal();
const positiveDecimal = decimal({ positive: true });
const optionalBooleanQuery = z.enum(['true', 'false'])
  .transform((value) => value === 'true')
  .optional();
const pageQuery = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
};

export const inventoryListSchema = requestSchema({
  query: z.object({
    ...pageQuery,
    search: z.string().trim().max(200).optional(),
    skuId: uuid.optional(),
    locationId: uuid.optional(),
    lowStock: optionalBooleanQuery,
  }).strict(),
});

export const inventorySummarySchema = requestSchema({
  query: z.object({}).strict(),
});

export const movementListSchema = requestSchema({
  query: z.object({
    ...pageQuery,
    skuId: uuid.optional(),
    locationId: uuid.optional(),
    movementType: movementType.optional(),
    stockBucket: stockBucket.optional(),
    referenceType: z.enum([
      'goods_receipt',
      'inventory_transfer',
      'inventory_adjustment',
      'future_sale',
      'future_sale_return',
    ]).optional(),
    dateFrom: isoDate.optional(),
    dateTo: isoDate.optional(),
  }).strict(),
});

export const inventoryIdSchema = requestSchema({
  params: z.object({ id: uuid }).strict(),
});

export const adjustmentCreateSchema = requestSchema({
  body: z.object({
    skuId: uuid,
    locationId: uuid,
    direction: z.enum(['in', 'out', 'move']),
    stockBucket,
    destinationBucket: stockBucket.optional(),
    quantity: positiveDecimal,
    reason: z.string().trim().min(3).max(240),
    notes: optionalText(10_000),
    occurredAt: isoDateTime.optional(),
  }).strict().superRefine((value, context) => {
    if (value.direction === 'move' && !value.destinationBucket) {
      context.addIssue({
        code: 'custom',
        path: ['destinationBucket'],
        message: 'A destination bucket is required for a bucket movement.',
      });
    }
    if (value.direction !== 'move' && value.destinationBucket) {
      context.addIssue({
        code: 'custom',
        path: ['destinationBucket'],
        message: 'Destination bucket is used only for bucket movements.',
      });
    }
    if (value.destinationBucket === value.stockBucket) {
      context.addIssue({
        code: 'custom',
        path: ['destinationBucket'],
        message: 'Destination bucket must be different.',
      });
    }
  }),
});

const ruleFields = {
  reorderPoint: nonNegativeDecimal,
  safetyStock: nonNegativeDecimal,
  targetStock: nonNegativeDecimal.nullable().optional(),
  preferredSupplierProductId: uuid.nullable().optional(),
  isActive: z.boolean(),
};

export const reorderRuleListSchema = requestSchema({
  query: z.object({
    ...pageQuery,
    skuId: uuid.optional(),
    locationId: uuid.optional(),
    isActive: optionalBooleanQuery,
  }).strict(),
});

export const reorderRuleCreateSchema = requestSchema({
  body: z.object({
    skuId: uuid,
    locationId: uuid,
    ...ruleFields,
  }).strict(),
});

export const reorderRulePatchSchema = requestSchema({
  params: z.object({ id: uuid }).strict(),
  body: nonEmptyPatch(z.object({
    reorderPoint: nonNegativeDecimal.optional(),
    safetyStock: nonNegativeDecimal.optional(),
    targetStock: ruleFields.targetStock,
    preferredSupplierProductId: ruleFields.preferredSupplierProductId,
    isActive: z.boolean().optional(),
  }).strict()),
});

const transferItem = z.object({
  skuId: uuid,
  quantity: positiveDecimal,
}).strict();

export const transferListSchema = requestSchema({
  query: z.object({
    ...pageQuery,
    search: z.string().trim().max(200).optional(),
    status: z.enum(['draft', 'in_transit', 'received', 'cancelled']).optional(),
    locationId: uuid.optional(),
  }).strict(),
});

export const transferCreateSchema = requestSchema({
  body: z.object({
    transferNumber: z.string().trim().min(1).max(80)
      .transform((value) => value.toUpperCase())
      .optional(),
    sourceLocationId: uuid,
    destinationLocationId: uuid,
    notes: optionalText(10_000),
    items: z.array(transferItem).min(1).max(500),
  }).strict(),
});

export const transferPatchSchema = requestSchema({
  params: z.object({ id: uuid }).strict(),
  body: nonEmptyPatch(z.object({
    sourceLocationId: uuid.optional(),
    destinationLocationId: uuid.optional(),
    notes: optionalText(10_000),
    items: z.array(transferItem).min(1).max(500).optional(),
  }).strict()),
});
