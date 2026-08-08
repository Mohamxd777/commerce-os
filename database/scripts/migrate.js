import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeDatabase, pool } from '../../server/src/config/database.js';

const databaseDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDirectory = path.join(databaseDirectory, 'migrations');
const migrationLockId = 730154;

function describeError(error) {
  if (error.message) return error.message;
  if (Array.isArray(error.errors)) {
    return error.errors.map((item) => item.code + ': ' + item.message).join('; ');
  }
  return String(error);
}

function checksum(sql) {
  return createHash('sha256').update(sql).digest('hex');
}

async function migrate() {
  const files = (await readdir(migrationsDirectory))
    .filter((file) => file.endsWith('.sql'))
    .sort();

  const database = await pool.connect();

  try {
    await database.query('SELECT pg_advisory_lock($1)', [migrationLockId]);
    await database.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         filename VARCHAR(255) PRIMARY KEY,
         checksum CHAR(64) NOT NULL,
         applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
       )`,
    );

    for (const filename of files) {
      const sql = await readFile(path.join(migrationsDirectory, filename), 'utf8');
      const fileChecksum = checksum(sql);
      const existing = await database.query(
        'SELECT checksum FROM schema_migrations WHERE filename = $1',
        [filename],
      );

      if (existing.rowCount > 0) {
        if (existing.rows[0].checksum !== fileChecksum) {
          throw new Error(
            'Migration ' + filename + ' changed after it was applied. Add a new migration instead.',
          );
        }
        console.info('Already applied: ' + filename);
        continue;
      }

      await database.query('BEGIN');
      try {
        await database.query(sql);
        await database.query(
          'INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)',
          [filename, fileChecksum],
        );
        await database.query('COMMIT');
        console.info('Applied: ' + filename);
      } catch (error) {
        await database.query('ROLLBACK');
        throw error;
      }
    }

    console.info('Database migrations are up to date.');
  } finally {
    await database.query('SELECT pg_advisory_unlock($1)', [migrationLockId]).catch(() => {});
    database.release();
  }
}

migrate()
  .catch((error) => {
    console.error('Database migration failed:', describeError(error));
    process.exitCode = 1;
  })
  .finally(closeDatabase);
