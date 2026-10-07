import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { db } from './store.ts';

type UserRecord = { id: string; username: string; password_hash: string };
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const passwordHash = (password: string) => {
  const salt = randomBytes(16).toString('hex');
  return `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
};
const passwordMatches = (password: string, stored: string) => {
  const [algorithm, salt, digest] = stored.split(':');
  if (algorithm !== 'scrypt' || !/^[a-f0-9]{32}$/.test(salt || '') || !/^[a-f0-9]{128}$/.test(digest || '')) return false;
  return timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(digest, 'hex'));
};
export function credentialVersion(user: Pick<UserRecord, 'id' | 'password_hash'>) {
  return hash(`user-session-v1:${user.id}:${user.password_hash}:${process.env.DELIVERY_SECRET || ''}`);
}
export function validateUsername(username: string) {
  if (!/^[a-zA-Z0-9._-]{3,64}$/.test(username)) throw new Error('Username must be 3–64 letters, numbers, dots, underscores or hyphens');
}
export function validatePassword(password: string) {
  if (password.length < 12 || password.length > 128) throw new Error('Password must be 12–128 characters');
}
export async function listUsers() {
  return db().prepare('SELECT id,username,created_at,updated_at FROM admin_users ORDER BY username').all();
}
export async function getUser(id: string): Promise<UserRecord | undefined> {
  return db().prepare('SELECT id,username,password_hash FROM admin_users WHERE id=?').get(id);
}
export async function createUser(username: string, password: string) {
  validateUsername(username); validatePassword(password);
  const id = randomUUID(), now = new Date().toISOString();
  try { await db().prepare('INSERT INTO admin_users(id,username,password_hash,created_at,updated_at) VALUES(?,?,?,?,?)').run(id, username, passwordHash(password), now, now); }
  catch (error) { if (/unique|duplicate/i.test(String(error))) throw new Error('Username already exists'); throw error; }
  return { id, username, created_at: now, updated_at: now };
}
export async function updateUser(id: string, changes: { username?: string; password?: string }) {
  if (!changes.username && !changes.password) throw new Error('Enter a new username or password');
  if (changes.username) validateUsername(changes.username);
  if (changes.password) validatePassword(changes.password);
  const fields: string[] = [], values: string[] = [];
  if (changes.username) { fields.push('username=?'); values.push(changes.username); }
  if (changes.password) { fields.push('password_hash=?'); values.push(passwordHash(changes.password)); }
  fields.push('updated_at=?'); values.push(new Date().toISOString());
  try {
    const result = await db().prepare(`UPDATE admin_users SET ${fields.join(',')} WHERE id=?`).run(...values, id);
    if (!result.changes) return null;
  } catch (error) { if (/unique|duplicate/i.test(String(error))) throw new Error('Username already exists'); throw error; }
  return db().prepare('SELECT id,username,created_at,updated_at FROM admin_users WHERE id=?').get(id);
}
export async function authenticate(username: string, password: string) {
  if (username && !/^[a-zA-Z0-9._-]{3,64}$/.test(username)) return null;
  const user = username ? await db().prepare('SELECT id,username,password_hash FROM admin_users WHERE username=?').get(username) as UserRecord | undefined : undefined;
  if (user) return passwordMatches(password, user.password_hash) ? { id: user.id, username: user.username } : null;
  // The previous password-only account initializes the first database user once.
  if (username && username.toLowerCase() !== 'admin') return null;
  if (!process.env.ADMIN_PASSWORD || !password || !timingSafeEqual(Buffer.from(hash(password)), Buffer.from(hash(process.env.ADMIN_PASSWORD)))) return null;
  const count = await db().prepare('SELECT COUNT(*) AS total FROM admin_users').get();
  if (Number(count?.total) !== 0) return null;
  try { return await createUser('admin', password); }
  catch (error) { if (/Username already exists/.test(String(error))) return authenticate('admin', password); throw error; }
}
