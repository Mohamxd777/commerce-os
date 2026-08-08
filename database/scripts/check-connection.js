import { closeDatabase, pool } from '../../server/src/config/database.js';

function describeError(error) {
  if (error.message) return error.message;
  if (Array.isArray(error.errors)) {
    return error.errors.map((item) => item.code + ': ' + item.message).join('; ');
  }
  return String(error);
}

async function checkConnection() {
  const result = await pool.query(
    `SELECT
       current_database() AS database_name,
       current_user AS database_user,
       current_setting('server_version') AS server_version`,
  );
  const details = result.rows[0];

  console.info('PostgreSQL connection successful.');
  console.info('Database: ' + details.database_name);
  console.info('User: ' + details.database_user);
  console.info('Server version: ' + details.server_version);
}

checkConnection()
  .catch((error) => {
    console.error('PostgreSQL connection failed:', describeError(error));
    process.exitCode = 1;
  })
  .finally(closeDatabase);
