import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
dotenv.config({ path: path.join(rootDirectory, '.env'), quiet: true });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1).default('postgresql://commerce_os:change_me@localhost:5432/commerce_os'),
  DATABASE_SSL: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  COOKIE_NAME: z.string().min(1).default('commerce_os_session'),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().max(24 * 30).default(168),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),
  LOCAL_DATA_DIR: z.string().min(1).default(path.join(rootDirectory, '..', 'commerce-os-local-data')),
  IMAGE_UPLOAD_MAX_BYTES: z.coerce.number().int().positive().max(50 * 1024 * 1024).default(8 * 1024 * 1024),
  REMOTE_IMAGE_MAX_BYTES: z.coerce.number().int().positive().max(50 * 1024 * 1024).default(10 * 1024 * 1024),
  NOON_ANALYZER_MAX_BYTES: z.coerce.number().int().positive().max(10 * 1024 * 1024).default(2 * 1024 * 1024),
  NOON_ANALYZER_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60_000).default(12_000),
  NOON_ANALYZER_MAX_REDIRECTS: z.coerce.number().int().min(0).max(5).default(3),
  NOON_ANALYZER_USER_AGENT: z.string().min(10).max(300).default('CommerceOS/1.0 research-link-analyzer (+local user-initiated request)'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => issue.path.join('.') + ': ' + issue.message)
    .join(', ');
  throw new Error('Invalid environment configuration: ' + details);
}

export const env = Object.freeze(parsed.data);
export { rootDirectory };
