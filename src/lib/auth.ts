import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { db } from './store.ts';
export const cookieName='one_admin_session';
export const sessionSeconds=8*60*60;
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const credentials=()=>hash(`session-v2:${process.env.ADMIN_PASSWORD || ''}:${process.env.DELIVERY_SECRET || ''}`);
export function adminConfigured(){return !!process.env.ADMIN_PASSWORD;}
export function validPassword(value:string){
  if(!adminConfigured())return false;
  return timingSafeEqual(Buffer.from(hash(value)),Buffer.from(hash(process.env.ADMIN_PASSWORD!)));
}
export function sessionCookie(request:Request){return request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(`${cookieName}=`))?.slice(cookieName.length+1)||'';}
export function sameOrigin(request:Request){
  const origin=request.headers.get('origin');
  // Non-browser clients may omit Origin; cross-site browser writes may not.
  return (!origin || origin === new URL(process.env.APP_URL || request.url).origin) && request.headers.get('sec-fetch-site')!=='cross-site';
}
export async function isAdmin(request:Request,now=new Date()){
  if(!['GET','HEAD','OPTIONS'].includes(request.method) && !sameOrigin(request))return false;
  if(!adminConfigured())return process.env.NODE_ENV==='development';
  const token=sessionCookie(request);
  if(!/^[a-f0-9]{64}$/.test(token))return false;
  const row=await db().prepare('SELECT * FROM admin_sessions WHERE token_hash=?').get(hash(token));
  return !!row && !row.revoked_at && String(row.expires_at)>now.toISOString() && row.credential_version===credentials();
}
export async function createSession(now=new Date()){
  const token=randomBytes(32).toString('hex');
  await db().prepare('INSERT INTO admin_sessions(token_hash,credential_version,created_at,expires_at) VALUES(?,?,?,?)').run(hash(token),credentials(),now.toISOString(),new Date(now.getTime()+sessionSeconds*1000).toISOString());
  return token;
}
export async function revokeSession(request:Request,all=false){
  if(all)await db().prepare('UPDATE admin_sessions SET revoked_at=? WHERE revoked_at IS NULL').run(new Date().toISOString());
  else await db().prepare('UPDATE admin_sessions SET revoked_at=? WHERE token_hash=?').run(new Date().toISOString(),hash(sessionCookie(request)));
}
export async function allowLogin(request:Request,now=new Date()){
  // Enable only behind a proxy that overwrites this header and blocks direct access.
  const ip=process.env.TRUST_PROXY==='true' ? request.headers.get('x-real-ip') || 'unknown' : 'untrusted';
  const key=createHmac('sha256',process.env.DELIVERY_SECRET || process.env.ADMIN_PASSWORD || 'local').update(ip).digest('hex');
  return db().transaction(async tx=>{
    let allowed=true;
    for(const [bucket,limit] of [['global',50],[key,10]] as const){
      const id=hash(bucket),stamp=now.toISOString();
      // MariaDB INSERT IGNORE takes a shared duplicate-key lock, which can
      // deadlock when concurrent logins then upgrade it to FOR UPDATE.
      await tx.prepare(tx.provider==='sqlite'
        ? 'INSERT OR IGNORE INTO login_attempts(key_hash,window_started_at,attempts) VALUES(?,?,0)'
        : 'INSERT INTO login_attempts(key_hash,window_started_at,attempts) VALUES(?,?,0) ON DUPLICATE KEY UPDATE key_hash=VALUES(key_hash)').run(id,stamp);
      const row=await tx.prepare(`SELECT * FROM login_attempts WHERE key_hash=?${tx.provider==='mariadb'?' FOR UPDATE':''}`).get(id);
      const expired=now.getTime()-Date.parse(String(row!.window_started_at))>=900000;
      const attempts=expired?1:Number(row!.attempts)+1;
      if(attempts>limit)allowed=false;
      await tx.prepare('UPDATE login_attempts SET attempts=?,window_started_at=? WHERE key_hash=?').run(Math.min(attempts,1000000),expired?stamp:row!.window_started_at,id);
    }
    return allowed;
  });
}
