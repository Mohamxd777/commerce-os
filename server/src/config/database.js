import pg from 'pg';
import { env } from './env.js';

const { Pool, types } = pg;

// PostgreSQL DATE values have no timezone. Keep them as YYYY-MM-DD strings so
// JSON serialization cannot shift a purchasing date across calendar days.
types.setTypeParser(1082, (value) => value);

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.DATABASE_SSL ? { rejectUnauthorized: true } : false,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error', error);
});

export function query(text, parameters) {
  return pool.query(text, parameters);
}

export function closeDatabase() {
  return pool.end();
}
