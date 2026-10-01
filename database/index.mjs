import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';

// Both providers return the same Promise-based interface. Dates are UTC ISO strings.
export function createDatabase(env = process.env) {
  const provider = env.DB_PROVIDER || 'sqlite';
  if (!['sqlite', 'mariadb'].includes(provider)) throw new Error('DB_PROVIDER must be sqlite or mariadb');
  let connectionPromise;
  let readyPromise;
  const migrationDir = resolve(process.cwd(), 'database/migrations', provider);
  const migrations = () => readdirSync(migrationDir).filter(name => /^\d+.*\.sql$/.test(name)).sort().map(name => {
    const sql = readFileSync(resolve(migrationDir, name), 'utf8');
    return { version: name.replace('.sql', ''), sql, checksum: createHash('sha256').update(sql).digest('hex') };
  });
  async function connect() {
    if (!connectionPromise) connectionPromise = (async () => {
      if (provider === 'sqlite') {
        const { DatabaseSync } = await import('node:sqlite');
        const path = resolve(env.DATABASE_PATH || 'data/one-adserver.sqlite');
        mkdirSync(dirname(path), { recursive: true });
        const connection = new DatabaseSync(path);
        connection.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
        return connection;
      }
      if (!env.DB_NAME || !env.DB_USER) throw new Error('MariaDB requires DB_NAME and DB_USER');
      const { default: mariadb } = await import('mariadb');
      return mariadb.createPool({
        host: env.DB_HOST || '127.0.0.1', port: Number(env.DB_PORT || 3306),
        user: env.DB_USER, password: env.DB_PASSWORD || '', database: env.DB_NAME,
        ...(env.DB_SOCKET ? { socketPath: env.DB_SOCKET } : {}),
        connectionLimit: Number(env.DB_POOL_SIZE || 10),
        bigIntAsNumber: true, decimalAsNumber: true, checkNumberRange: true,
        charset: 'utf8mb4', timezone: 'Z',
        ...(env.DB_SSL === 'true' ? { ssl: env.DB_SSL_CA ? { ca: readFileSync(env.DB_SSL_CA, 'utf8'), rejectUnauthorized: true } : true } : {}),
      });
    })().catch(error => { connectionPromise = undefined; throw error; });
    return connectionPromise;
  }
  async function raw(sql, params = [], mode = 'all', connection) {
    const conn = connection || await connect();
    if (provider === 'sqlite') {
      const statement = conn.prepare(sql);
      if (mode === 'run') return { changes: Number(statement.run(...params).changes) };
      return mode === 'get' ? statement.get(...params) : statement.all(...params);
    }
    const result = await conn.query(sql, params);
    if (mode === 'run') return { changes: Number(result.affectedRows) };
    return mode === 'get' ? result[0] : Array.from(result);
  }
  async function migrate() {
    const conn = await connect();
    const migrationConnection = provider === 'mariadb' ? await conn.getConnection() : conn;
    let locked = false;
    const lockName = `one-adserver:${env.DB_NAME || 'sqlite'}:migrations`.slice(0, 64);
    try {
      if (provider === 'sqlite') { conn.exec('BEGIN IMMEDIATE'); locked = true; }
      else {
        const row = await raw('SELECT GET_LOCK(?, 30) AS acquired', [lockName], 'get', migrationConnection);
        if (Number(row.acquired) !== 1) throw new Error('Could not acquire the database migration lock');
        locked = true;
      }
      await raw(`CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(100) PRIMARY KEY, checksum VARCHAR(64) NOT NULL, applied_at VARCHAR(24) NOT NULL)${provider === 'mariadb' ? ' ENGINE=InnoDB' : ''}`, [], 'run', migrationConnection);
      for (const migration of migrations()) {
        const existing = await raw('SELECT checksum FROM schema_migrations WHERE version=?', [migration.version], 'get', migrationConnection);
        if (existing) {
          if (existing.checksum !== migration.checksum) throw new Error(`Applied migration ${migration.version} was modified`);
          continue;
        }
        // Migration files contain simple DDL only; every statement is restartable.
        for (const statement of migration.sql.split(';').map(value => value.trim()).filter(Boolean)) await raw(statement, [], 'run', migrationConnection);
        await raw('INSERT INTO schema_migrations (version,checksum,applied_at) VALUES (?,?,?)', [migration.version, migration.checksum, new Date().toISOString()], 'run', migrationConnection);
      }
      if (provider === 'sqlite') { conn.exec('COMMIT'); locked = false; }
    } catch (error) {
      if (provider === 'sqlite' && locked) { conn.exec('ROLLBACK'); locked = false; }
      throw error;
    } finally {
      if (provider === 'mariadb') {
        try { if (locked) await raw('SELECT RELEASE_LOCK(?)', [lockName], 'get', migrationConnection); }
        finally { migrationConnection.release(); }
      }
    }
  }
  async function ready() {
    if (!readyPromise) readyPromise = (async () => {
      if (provider === 'sqlite') await migrate();
      else {
        const applied = await raw('SELECT version,checksum FROM schema_migrations');
        for (const migration of migrations()) {
          if (!applied.some(row => row.version === migration.version && row.checksum === migration.checksum)) throw new Error('Database schema is out of date. Run npm run db:migrate before starting the app.');
        }
      }
    })().catch(error => { readyPromise = undefined; throw error; });
    await readyPromise;
  }
  return {
    provider,
    migrate,
    prepare(sql) {
      return Object.fromEntries(['all', 'get', 'run'].map(mode => [mode, async (...params) => { await ready(); return raw(sql, params, mode); }]));
    },
    async close() { if (connectionPromise) { const conn = await connectionPromise; if (provider === 'sqlite') conn.close(); else await conn.end(); } connectionPromise = undefined; readyPromise = undefined; },
  };
}
