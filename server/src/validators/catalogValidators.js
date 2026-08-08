import { z } from 'zod';

const uuid = z.string().uuid('A valid UUID is required.');
const optionalText = (maximum) => z.string().trim().min(1).max(maximum).nullable().optional();
const optionalPositiveInteger = z.number().int().positive().nullable().optional();

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

const pageQuery = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(160).optional(),
};

const optionalBooleanQuery = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .optional();

export const skuCodeSchema = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .transform((value) => value.toUpperCase())
  .refine((value) => /^[A-Z0-9][A-Z0-9._/-]{2,63}$/.test(value), {
    message: 'SKU code may contain letters, numbers, dots, underscores, slashes, and hyphens.',
  });

export const barcodeSchema = z
  .object({
    type: z.enum(['internal', 'manufacturer', 'ean', 'upc', 'gtin']),
    value: z.string().trim().min(3).max(64),
    isPrimary: z.boolean().default(false),
    isActive: z.boolean().default(true),
  })
  .strict()
  .superRefine((barcode, context) => {
    if (['ean', 'upc', 'gtin'].includes(barcode.type) && !/^\d+$/.test(barcode.value)) {
      context.addIssue({
        code: 'custom',
        path: ['value'],
        message: barcode.type.toUpperCase() + ' identifiers must contain digits only.',
      });
    }

    const validLengths = {
      ean: [8, 13],
      upc: [12],
      gtin: [8, 12, 13, 14],
    };
    if (validLengths[barcode.type] && !validLengths[barcode.type].includes(barcode.value.length)) {
      context.addIssue({
        code: 'custom',
        path: ['value'],
        message: 'Invalid ' + barcode.type.toUpperCase() + ' identifier length.',
      });
    }
  });

const skuInput = z
  .object({
    skuCode: skuCodeSchema,
    manufacturerPartNumber: optionalText(160),
    serialTrackingEnabled: z.boolean().default(false),
    isActive: z.boolean().default(true),
    barcodes: z.array(barcodeSchema).max(20).default([]),
  })
  .strict();

const variantInput = z
  .object({
    name: z.string().trim().min(1).max(160),
    attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
    weightGrams: optionalPositiveInteger,
    lengthMm: optionalPositiveInteger,
    widthMm: optionalPositiveInteger,
    heightMm: optionalPositiveInteger,
    isActive: z.boolean().default(true),
    skus: z.array(skuInput).min(1).max(50),
  })
  .strict();

const productFields = {
  brandId: uuid.nullable().optional(),
  categoryId: uuid,
  name: z.string().trim().min(1).max(200),
  modelNumber: optionalText(120),
  description: optionalText(10_000),
  warrantyMonths: z.number().int().min(0).max(600).nullable().optional(),
  defaultWeightGrams: optionalPositiveInteger,
  defaultLengthMm: optionalPositiveInteger,
  defaultWidthMm: optionalPositiveInteger,
  defaultHeightMm: optionalPositiveInteger,
  notes: optionalText(10_000),
  status: z.enum(['active', 'draft', 'archived']).default('draft'),
};

export const brandListSchema = requestSchema({
  query: z
    .object({
      ...pageQuery,
      isActive: optionalBooleanQuery,
    })
    .strict(),
});

export const brandCreateSchema = requestSchema({
  body: z
    .object({
      name: z.string().trim().min(1).max(160),
      websiteUrl: z.string().trim().url().max(500).nullable().optional(),
      notes: optionalText(10_000),
      isActive: z.boolean().default(true),
    })
    .strict(),
});

export const brandPatchSchema = requestSchema({
  params: z.object({ id: uuid }).strict(),
  body: nonEmptyPatch(
    z
      .object({
        name: z.string().trim().min(1).max(160).optional(),
        websiteUrl: z.string().trim().url().max(500).nullable().optional(),
        notes: optionalText(10_000),
        isActive: z.boolean().optional(),
      })
      .strict(),
  ),
});

export const categoryListSchema = requestSchema({
  query: z
    .object({
      ...pageQuery,
      isActive: optionalBooleanQuery,
    })
    .strict(),
});

export const categoryCreateSchema = requestSchema({
  body: z
    .object({
      parentId: uuid.nullable().optional(),
      name: z.string().trim().min(1).max(160),
      description: optionalText(10_000),
      isActive: z.boolean().default(true),
    })
    .strict(),
});

export const categoryPatchSchema = requestSchema({
  params: z.object({ id: uuid }).strict(),
  body: nonEmptyPatch(
    z
      .object({
        parentId: uuid.nullable().optional(),
        name: z.string().trim().min(1).max(160).optional(),
        description: optionalText(10_000),
        isActive: z.boolean().optional(),
      })
      .strict(),
  ),
});

export const productListSchema = requestSchema({
  query: z
    .object({
      ...pageQuery,
      categoryId: uuid.optional(),
      brandId: uuid.optional(),
      status: z.enum(['active', 'draft', 'archived']).optional(),
    })
    .strict(),
});

export const productCreateSchema = requestSchema({
  body: z
    .object({
      ...productFields,
      variants: z.array(variantInput).min(1).max(50),
    })
    .strict(),
});

export const productPatchSchema = requestSchema({
  params: z.object({ id: uuid }).strict(),
  body: nonEmptyPatch(
    z
      .object({
        brandId: uuid.nullable().optional(),
        categoryId: uuid.optional(),
        name: z.string().trim().min(1).max(200).optional(),
        modelNumber: optionalText(120),
        description: optionalText(10_000),
        warrantyMonths: z.number().int().min(0).max(600).nullable().optional(),
        defaultWeightGrams: optionalPositiveInteger,
        defaultLengthMm: optionalPositiveInteger,
        defaultWidthMm: optionalPositiveInteger,
        defaultHeightMm: optionalPositiveInteger,
        notes: optionalText(10_000),
        status: z.enum(['active', 'draft', 'archived']).optional(),
      })
      .strict(),
  ),
});

export const skuListSchema = requestSchema({
  query: z
    .object({
      ...pageQuery,
      isActive: optionalBooleanQuery,
      serialTrackingEnabled: optionalBooleanQuery,
      productId: uuid.optional(),
    })
    .strict(),
});

export const skuCreateSchema = requestSchema({
  body: z
    .object({
      productVariantId: uuid,
      ...skuInput.shape,
    })
    .strict(),
});

export const skuPatchSchema = requestSchema({
  params: z.object({ id: uuid }).strict(),
  body: nonEmptyPatch(
    z
      .object({
        manufacturerPartNumber: optionalText(160),
        serialTrackingEnabled: z.boolean().optional(),
        isActive: z.boolean().optional(),
        barcodes: z.array(barcodeSchema).max(20).optional(),
      })
      .strict(),
  ),
});

export const idParamSchema = requestSchema({
  params: z.object({ id: uuid }).strict(),
});
