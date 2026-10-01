import nextEnv from '@next/env';
import { createDatabase } from '../database/index.mjs';

nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production');
const database = createDatabase();
try {
  await database.migrate();
  const versions = await database.prepare('SELECT version, applied_at FROM schema_migrations ORDER BY version').all();
  console.log(`${database.provider}: schema is ready (${versions.map(row => row.version).join(', ')})`);
} catch (error) {
  console.error(`Database setup failed: ${error.message}`);
  process.exitCode = 1;
} finally { await database.close(); }
