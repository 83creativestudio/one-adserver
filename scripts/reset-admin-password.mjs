import { randomBytes, scryptSync } from 'node:crypto';
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import nextEnv from '@next/env';
import { createDatabase } from '../database/index.mjs';

nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production');

const username = process.argv[2] || 'admin';
if (!/^[a-zA-Z0-9._-]{3,64}$/.test(username)) {
  console.error('Enter a valid username.');
  process.exit(1);
}
if (!process.stdin.isTTY || !process.stdout.isTTY) {
  console.error('Run this command in an interactive terminal (docker compose exec -it app npm run admin:reset).');
  process.exit(1);
}

// Readline owns the TTY in raw mode; discard its output so the password never echoes.
const silent = new Writable({ write(_chunk, _encoding, done) { done(); } });
const prompt = createInterface({ input: process.stdin, output: silent, terminal: true });
const ask = label => new Promise(resolve => {
  process.stdout.write(label);
  prompt.question('', answer => { process.stdout.write('\n'); resolve(answer); });
});

let database;
try {
  const password = await ask(`New password for ${username} (12–128 characters): `);
  const confirmation = await ask('Type the same password again: ');
  prompt.close();
  if (password !== confirmation) throw new Error('Passwords did not match; nothing was changed.');
  if (password.length < 12 || password.length > 128) throw new Error('Password must be 12–128 characters; nothing was changed.');

  database = createDatabase();
  const user = await database.prepare('SELECT id FROM admin_users WHERE username=?').get(username);
  if (!user) throw new Error(`User ${username} was not found; nothing was changed.`);
  const salt = randomBytes(16).toString('hex');
  const hash = `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
  const result = await database.prepare('UPDATE admin_users SET password_hash=?,updated_at=? WHERE id=?').run(hash, new Date().toISOString(), user.id);
  if (result.changes !== 1) throw new Error('Password update did not affect one user.');
  console.log(`Password updated for ${username}. Existing sessions are invalidated.`);

  if (process.env.APP_URL) {
    try {
      const response = await fetch('http://127.0.0.1:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: process.env.APP_URL },
        body: JSON.stringify({ username, password }),
        signal: AbortSignal.timeout(10000),
      });
      console.log(response.ok ? 'Login verification passed.' : `Password saved, but login verification returned HTTP ${response.status}.`);
    } catch (error) {
      console.log(`Password saved, but login verification could not connect: ${error.message}`);
    }
  }
} catch (error) {
  prompt.close();
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (database) await database.close();
}
