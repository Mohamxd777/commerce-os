import { z } from 'zod';

const uuid = z.string().uuid();
const entityType = z.enum(['candidate', 'supplier_option', 'sample', 'marketplace_observation']);
const emptyBody = z.object({}).optional();

export const imageListSchema = z.object({
  body: emptyBody, params: z.record(z.string(), z.string()).optional(),
  query: z.object({ entityType, entityId: uuid }).strict(),
});

export const imageContentSchema = z.object({
  body: emptyBody, params: z.object({ id: uuid }).strict(),
  query: z.object({ organizationId: uuid.optional() }).strict(),
});

export const imageLinkSchema = z.object({
  body: z.object({ entityType, entityId: uuid }).strict(),
  params: z.object({ id: uuid }).strict(), query: z.record(z.string(), z.unknown()).optional(),
});

export const imageRemoveSchema = z.object({
  body: emptyBody, params: z.object({ id: uuid }).strict(),
  query: z.object({ entityType, entityId: uuid }).strict(),
});

export const noonImageImportSchema = z.object({
  body: z.object({
    entityType, entityId: uuid,
    urls: z.array(z.string().trim().url().max(1000)).min(1).max(12),
    primaryUrl: z.string().trim().url().max(1000).nullable().optional(),
  }).strict(),
  params: z.record(z.string(), z.string()).optional(), query: z.record(z.string(), z.unknown()).optional(),
});

