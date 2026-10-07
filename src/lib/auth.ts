import { createHash, createHmac, randomBytes } from 'node:crypto';
import { db } from './store.ts';
import { credentialVersion, getUser } from './users.ts';
export const cookieName='one_admin_session';
export const sessionSeconds=8*60*60;
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
export function adminConfigured(){return !!process.env.ADMIN_PASSWORD;}
export function sessionCookie(request:Request){return request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(`${cookieName}=`))?.slice(cookieName.length+1)||'';}
export function sameOrigin(request:Request){
  const origin=request.headers.get('origin');
  // Non-browser clients may omit Origin; cross-site browser writes may not.
  return (!origin || origin === new URL(process.env.APP_URL || request.url).origin) && request.headers.get('sec-fetch-site')!=='cross-site';
}
export async function isAdmin(request:Request,now=new Date()){
  if(!['GET','HEAD','OPTIONS'].includes(request.method) && !sameOrigin(request))return false;
  if(!adminConfigured() && process.env.NODE_ENV==='development')return true;
  return !!await currentUser(request,now);
}
export async function currentUser(request:Request,now=new Date()){
  if(!['GET','HEAD','OPTIONS'].includes(request.method) && !sameOrigin(request))return null;
  const token=sessionCookie(request);
  if(!/^[a-f0-9]{64}$/.test(token))return null;
  const row=await db().prepare('SELECT u.id,u.username,u.password_hash,s.credential_version,s.expires_at,s.revoked_at FROM user_sessions s JOIN admin_users u ON u.id=s.user_id WHERE s.token_hash=?').get(hash(token)) as {id:string;username:string;password_hash:string;credential_version:string;expires_at:string;revoked_at:string|null}|undefined;
  return row && !row.revoked_at && row.expires_at>now.toISOString() && row.credential_version===credentialVersion(row) ? {id:row.id,username:row.username} : null;
}
export async function createSession(userId:string,now=new Date()){
  const user=await getUser(userId);
  if(!user)throw new Error('User not found');
  const token=randomBytes(32).toString('hex');
  await db().prepare('INSERT INTO user_sessions(token_hash,user_id,credential_version,created_at,expires_at) VALUES(?,?,?,?,?)').run(hash(token),userId,credentialVersion(user),now.toISOString(),new Date(now.getTime()+sessionSeconds*1000).toISOString());
  return token;
}
export async function revokeSession(request:Request,all=false){
  if(all)await db().prepare('UPDATE user_sessions SET revoked_at=? WHERE revoked_at IS NULL').run(new Date().toISOString());
  else await db().prepare('UPDATE user_sessions SET revoked_at=? WHERE token_hash=?').run(new Date().toISOString(),hash(sessionCookie(request)));
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
