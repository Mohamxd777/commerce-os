import { app } from './app.js';
import { closeDatabase } from './config/database.js';
import { env } from './config/env.js';

const server = app.listen(env.PORT, () => {
  console.info('Commerce OS API listening on http://localhost:' + env.PORT);
});

async function shutdown(signal) {
  console.info(signal + ' received. Closing the API gracefully.');
  server.close(async () => {
    await closeDatabase();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
