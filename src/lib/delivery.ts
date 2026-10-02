import { randomUUID } from 'node:crypto';
import { db } from './store.ts';
import { verifyDelivery } from './delivery-token.ts';
import type { Transaction } from '../../database/index.mjs';
type Ad = {id:string;campaign_id:string;name:string;image_url:string;target_url:string;width:number;height:number};
type Delivery = Ad & {creative_id:string;placement_id:string;created_at:string;expires_at:string;impression_at:string|null;click_at:string|null;outcome:string};
const lock = (tx:Transaction) => tx.provider === 'mariadb' ? ' FOR UPDATE' : '';
async function event(tx:Transaction, kind:string, row:{creative_id:string;campaign_id:string;placement_id:string}, now:string) {
  await tx.prepare('INSERT INTO events(id,creative_id,campaign_id,placement_id,kind,occurred_at) VALUES(?,?,?,?,?,?)').run(randomUUID(),row.creative_id,row.campaign_id,row.placement_id,kind,now);
}
export async function servePlacement(placementId:string, now = new Date()) {
  const placement = await db().prepare('SELECT * FROM placements WHERE id=?').get(placementId);
  if (!placement) return undefined;
  const stamp=now.toISOString(), day=stamp.slice(0,10), start=`${day}T00:00:00.000Z`;
  const midnight=new Date(Date.parse(start)+86400000).toISOString();
  const expires=new Date(Math.min(now.getTime()+300000,Date.parse(midnight))).toISOString();
  const candidates=await db().prepare('SELECT c.id,c.priority FROM campaigns c JOIN campaign_placements cp ON cp.campaign_id=c.id WHERE cp.placement_id=?').all(placementId);
  while(candidates.length) {
    let draw=Math.random()*candidates.reduce((n,c)=>n+Number(c.priority),0);
    let index=candidates.findIndex(c=>(draw-=Number(c.priority))<0); if(index<0)index=candidates.length-1;
    const candidate=candidates.splice(index,1)[0];
    const result=await db().transaction(async tx=>{
      // Serialize decisions for this campaign across processes and placements.
      const campaign=await tx.prepare(`SELECT * FROM campaigns WHERE id=?${lock(tx)}`).get(candidate.id);
      if(!campaign || campaign.status!=='active' || (campaign.start_at && String(campaign.start_at)>day) || (campaign.end_at && String(campaign.end_at)<day))return null;
      if(!await tx.prepare('SELECT campaign_id FROM campaign_placements WHERE campaign_id=? AND placement_id=?').get(candidate.id,placementId))return null;
      const ads=await tx.prepare('SELECT cr.* FROM creatives cr JOIN placements p ON p.width=cr.width AND p.height=cr.height WHERE cr.campaign_id=? AND p.id=?').all(candidate.id,placementId) as Ad[];
      if(!ads.length)return null;
      if(Number(campaign.daily_cap)>0) {
        const used=await tx.prepare('SELECT COUNT(*) AS n FROM delivery_requests WHERE campaign_id=? AND created_at>=? AND created_at<? AND (impression_at IS NOT NULL OR expires_at>?)').get(candidate.id,start,midnight,stamp);
        const cap=Number(campaign.daily_cap);
        const allowance=campaign.pacing==='even' ? Math.max(1,Math.ceil(cap*(now.getTime()-Date.parse(start))/86400000)) : cap;
        if(Number(used?.n)>=allowance)return null;
      }
      const ad=ads[Math.floor(Math.random()*ads.length)], id=randomUUID();
      await tx.prepare("INSERT INTO delivery_requests(id,placement_id,campaign_id,creative_id,outcome,created_at,expires_at,name,image_url,target_url,width,height) VALUES(?,?,?,?,'filled',?,?,?,?,?,?,?)").run(id,placementId,ad.campaign_id,ad.id,stamp,expires,ad.name,ad.image_url,ad.target_url,ad.width,ad.height);
      await event(tx,'request',{creative_id:ad.id,campaign_id:ad.campaign_id,placement_id:placementId},stamp);
      return {...ad,requestId:id};
    });
    if(result)return result;
  }
  await db().transaction(async tx=>{
    await tx.prepare("INSERT INTO delivery_requests(id,placement_id,campaign_id,creative_id,outcome,created_at,expires_at,name,image_url,target_url,width,height) VALUES(?,?,'','','empty',?,?,'','','',0,0)").run(randomUUID(),placementId,stamp,stamp);
    await event(tx,'request',{creative_id:'',campaign_id:'',placement_id:placementId},stamp);
  });
  return null;
}
export async function recordDelivery(id:string,token:string,kind:'impression'|'click',at?:Date) {
  if(!verifyDelivery(id,token))return null;
  const lookup=await db().prepare('SELECT campaign_id FROM delivery_requests WHERE id=?').get(id);
  if(!lookup)return null;
  return db().transaction(async tx=>{
    // Same lock order as reservation decisions; an expired reservation cannot
    // be converted to an impression while its replacement is being issued.
    await tx.prepare(`SELECT id FROM campaigns WHERE id=?${lock(tx)}`).get(lookup.campaign_id);
    const row=await tx.prepare(`SELECT * FROM delivery_requests WHERE id=?${lock(tx)}`).get(id) as Delivery|undefined;
    const now=at || new Date();
    if(!row || row.outcome!=='filled' || now.getTime()<Date.parse(row.created_at))return null;
    if(kind==='impression' && now.toISOString()>=row.expires_at)return null;
    if(kind==='click' && now.getTime()>=Date.parse(row.created_at)+86400000)return null;
    const field=kind==='impression'?'impression_at':'click_at';
    if(!row[field]) {
      await tx.prepare(`UPDATE delivery_requests SET ${field}=? WHERE id=?`).run(now.toISOString(),id);
      await event(tx,kind,row,now.toISOString());
    }
    return row;
  });
}
