import { z } from 'zod';

const uuid = z.string().uuid('A valid UUID is required.');
const optionalText = (maximum) => z.string().trim().min(1).max(maximum).nullable().optional();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use an ISO date in YYYY-MM-DD format.');
const currency = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .refine((value) => /^[A-Z]{3}$/.test(value), 'Currency must be a 3-letter code.');

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
      'Use a non-negative decimal with no more than 4 decimal places.',
    )
    .refine(
      (value) => !positive || !/^0+(?:\.0+)?$/.test(value),
      'The value must be greater than zero.',
    );
}

const nonNegativeDecimal = decimal();
const positiveDecimal = decimal({ positive: true });

const pageQuery = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(200).optional(),
};

const optionalBooleanQuery = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .optional();

const supplierFields = {
  name: z.string().trim().min(1).max(200),
  legalName: optionalText(240),
  contactPerson: optionalText(160),
  phone: z
    .string()
    .trim()
    .regex(/^[+0-9() .-]{7,40}$/, 'Enter a valid phone number.')
    .nullable()
    .optional(),
  email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()).nullable().optional(),
  websiteUrl: z.string().trim().url().max(500).nullable().optional(),
  address: optionalText(5_000),
  taxNumber: optionalText(100),
  notes: optionalText(10_000),
  paymentTermsDays: z.number().int().min(0).max(3_650).nullable().optional(),
  preferredCurrency: currency,
  isActive: z.boolean().default(true),
};

export const supplierListSchema = requestSchema({
  query: z.object({ ...pageQuery, isActive: optionalBooleanQuery }).strict(),
});

export const supplierCreateSchema = requestSchema({
  body: z.object(supplierFields).strict(),
});

export const supplierPatchSchema = requestSchema({
  params: z.object({ id: uuid }).strict(),
  body: nonEmptyPatch(
    z.object({
      name: supplierFields.name.optional(),
      legalName: supplierFields.legalName,
      contactPerson: supplierFields.contactPerson,
      phone: supplierFields.phone,
      email: supplierFields.email,
      websiteUrl: supplierFields.websiteUrl,
      address: supplierFields.address,
      taxNumber: supplierFields.taxNumber,
      notes: supplierFields.notes,
      paymentTermsDays: supplierFields.paymentTermsDays,
      preferredCurrency: currency.optional(),
      isActive: z.boolean().optional(),
    }).strict(),
  ),
});

export const supplierProductListSchema = requestSchema({
  query: z.object({
    ...pageQuery,
    supplierId: uuid.optional(),
    skuId: uuid.optional(),
    isActive: optionalBooleanQuery,
    preferred: optionalBooleanQuery,
  }).strict(),
});

export const supplierProductCreateSchema = requestSchema({
  body: z.object({
    supplierId: uuid,
    skuId: uuid,
    supplierSkuCode: optionalText(120),
    currentUnitCost: nonNegativeDecimal,
    currency,
    moq: positiveDecimal,
    leadTimeDays: z.number().int().min(0).max(3_650),
    preferred: z.boolean().default(false),
    isActive: z.boolean().default(true),
    notes: optionalText(10_000),
  }).strict(),
});

export const supplierProductPatchSchema = requestSchema({
  params: z.object({ id: uuid }).strict(),
  body: nonEmptyPatch(
    z.object({
      supplierSkuCode: optionalText(120),
      moq: positiveDecimal.optional(),
      leadTimeDays: z.number().int().min(0).max(3_650).optional(),
      preferred: z.boolean().optional(),
      isActive: z.boolean().optional(),
      notes: optionalText(10_000),
    }).strict(),
  ),
});

export const supplierPriceSchema = requestSchema({
  params: z.object({ id: uuid }).strict(),
  body: z.object({
    unitCost: nonNegativeDecimal,
    currency,
    source: optionalText(160),
    notes: optionalText(10_000),
  }).strict(),
});

export const skuSupplierComparisonSchema = requestSchema({
  params: z.object({ id: uuid }).strict(),
  query: z.object({
    page: pageQuery.page,
    limit: pageQuery.limit,
    isActive: optionalBooleanQuery,
  }).strict(),
});

const poItemSchema = z.object({
  skuId: uuid,
  supplierProductId: uuid.nullable().optional(),
  quantityOrdered: positiveDecimal,
  unitCost: nonNegativeDecimal,
  discountAmount: nonNegativeDecimal.default('0'),
  taxAmount: nonNegativeDecimal.default('0'),
  notes: optionalText(5_000),
}).strict();

const poEditableFields = {
  orderDate: isoDate,
  expectedDeliveryDate: isoDate.nullable().optional(),
  currency,
  paymentTermsDays: z.number().int().min(0).max(3_650).nullable().optional(),
  notes: optionalText(10_000),
  shippingCost: nonNegativeDecimal.default('0'),
  otherCost: nonNegativeDecimal.default('0'),
  items: z.array(poItemSchema).min(1).max(500),
};

export const purchaseOrderListSchema = requestSchema({
  query: z.object({
    ...pageQuery,
    supplierId: uuid.optional(),
    status: z.enum([
      'draft',
      'approved',
      'ordered',
      'partially_received',
      'received',
      'cancelled',
    ]).optional(),
    dateFrom: isoDate.optional(),
    dateTo: isoDate.optional(),
    expectedFrom: isoDate.optional(),
    expectedTo: isoDate.optional(),
  }).strict(),
});

export const purchaseOrderCreateSchema = requestSchema({
  body: z.object({
    supplierId: uuid,
    poNumber: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .transform((value) => value.toUpperCase())
      .refine((value) => /^[A-Z0-9][A-Z0-9._/-]{0,79}$/.test(value), {
        message: 'PO number may contain letters, numbers, dots, underscores, slashes, and hyphens.',
      }),
    ...poEditableFields,
  }).strict().superRefine((value, context) => {
    if (value.expectedDeliveryDate && value.expectedDeliveryDate < value.orderDate) {
      context.addIssue({
        code: 'custom',
        path: ['expectedDeliveryDate'],
        message: 'Expected delivery cannot be before the order date.',
      });
    }
  }),
});

export const purchaseOrderPatchSchema = requestSchema({
  params: z.object({ id: uuid }).strict(),
  body: nonEmptyPatch(
    z.object({
      orderDate: isoDate.optional(),
      expectedDeliveryDate: isoDate.nullable().optional(),
      currency: currency.optional(),
      paymentTermsDays: z.number().int().min(0).max(3_650).nullable().optional(),
      notes: optionalText(10_000),
      shippingCost: nonNegativeDecimal.optional(),
      otherCost: nonNegativeDecimal.optional(),
      items: z.array(poItemSchema).min(1).max(500).optional(),
    }).strict(),
  ),
});

export const purchaseOrderIdSchema = requestSchema({
  params: z.object({ id: uuid }).strict(),
});

export const goodsReceiptListSchema = requestSchema({
  query: z.object({
    ...pageQuery,
    purchaseOrderId: uuid.optional(),
    locationId: uuid.optional(),
    dateFrom: isoDate.optional(),
    dateTo: isoDate.optional(),
  }).strict(),
});

const receiptItemSchema = z.object({
  purchaseOrderItemId: uuid,
  quantityReceived: nonNegativeDecimal.default('0'),
  quantityRejected: nonNegativeDecimal.default('0'),
  conditionNotes: optionalText(5_000),
}).strict().refine(
  (item) => !/^0+(?:\.0+)?$/.test(item.quantityReceived)
    || !/^0+(?:\.0+)?$/.test(item.quantityRejected),
  { message: 'Enter an accepted or rejected quantity.' },
);

export const goodsReceiptCreateSchema = requestSchema({
  params: z.object({ id: uuid }).strict(),
  body: z.object({
    receiptNumber: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .transform((value) => value.toUpperCase())
      .optional(),
    receivedDate: isoDate,
    locationId: uuid,
    notes: optionalText(10_000),
    items: z.array(receiptItemSchema).min(1).max(500),
  }).strict(),
});

export const goodsReceiptIdSchema = requestSchema({
  params: z.object({ id: uuid }).strict(),
});

export const purchasingSummarySchema = requestSchema({
  query: z.object({
    dateFrom: isoDate.optional(),
    dateTo: isoDate.optional(),
  }).strict(),
});

export const locationListSchema = requestSchema({
  query: z.object({
    ...pageQuery,
    status: z.enum(['active', 'inactive', 'archived']).optional(),
  }).strict(),
});

export const locationCreateSchema = requestSchema({
  body: z.object({
    name: z.string().trim().min(1).max(140),
    code: z
      .string()
      .trim()
      .min(1)
      .max(40)
      .transform((value) => value.toUpperCase()),
    locationType: z.enum(['warehouse', 'store', 'office', 'supplier', 'other']).default('warehouse'),
    city: optionalText(100),
    governorate: optionalText(100),
    countryCode: z
      .string()
      .trim()
      .transform((value) => value.toUpperCase())
      .refine((value) => /^[A-Z]{2}$/.test(value), 'Use a 2-letter country code.')
      .default('EG'),
    timezone: z.string().trim().min(1).max(80).default('Africa/Cairo'),
  }).strict(),
});

export { currency as currencySchema, nonNegativeDecimal as moneySchema, positiveDecimal as quantitySchema };
