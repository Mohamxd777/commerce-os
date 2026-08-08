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
