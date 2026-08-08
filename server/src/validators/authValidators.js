import { z } from 'zod';

const requestParts = (body) =>
  z.object({
    body,
    params: z.record(z.string(), z.string()).optional(),
    query: z.record(z.string(), z.unknown()).optional(),
  });

const strongPassword = z
  .string()
  .min(12, 'Password must contain at least 12 characters.')
  .max(128)
  .regex(/[a-z]/, 'Password must include a lowercase letter.')
  .regex(/[A-Z]/, 'Password must include an uppercase letter.')
  .regex(/[0-9]/, 'Password must include a number.');

export const registerSchema = requestParts(
  z
    .object({
      email: z.string().trim().toLowerCase().email(),
      password: strongPassword,
      displayName: z.string().trim().min(2).max(100),
      organizationName: z.string().trim().min(2).max(160),
    })
    .strict(),
);

export const loginSchema = requestParts(
  z
    .object({
      email: z.string().trim().toLowerCase().email(),
      password: z.string().min(1).max(128),
    })
    .strict(),
);
