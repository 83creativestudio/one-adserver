import { NextRequest, NextResponse } from "next/server";
import { db, logEvent } from "@/lib/store";
import { signDelivery } from "@/lib/delivery-token";

export const runtime = "nodejs";
const headers = {"Access-Control-Allow-Origin":"*","Cache-Control":"no-store"};
type Candidate = {id:string;campaign_id:string;name:string;image_url:string;target_url:string;width:number;height:number;priority:number};

export async function GET(request: NextRequest) {
  const placementId = request.nextUrl.searchParams.get("placement");
  if (!placementId) return NextResponse.json({error:"placement is required"},{status:400,headers});
  const placement = await db().prepare("SELECT id,width,height FROM placements WHERE id=?").get(placementId) as {id:string;width:number;height:number}|undefined;
  if (!placement) return NextResponse.json({error:"Placement not found"},{status:404,headers});
  const today = new Date().toISOString().slice(0,10);
  const candidates = await db().prepare(`SELECT cr.id,cr.campaign_id,cr.name,cr.image_url,cr.target_url,cr.width,cr.height,c.priority FROM creatives cr JOIN campaigns c ON c.id=cr.campaign_id
    WHERE cr.width=? AND cr.height=? AND c.status='active' AND (c.start_at='' OR c.start_at<=?) AND (c.end_at='' OR c.end_at>=?)
    AND (c.daily_cap=0 OR (SELECT COUNT(*) FROM events e WHERE e.campaign_id=c.id AND e.kind='impression' AND e.occurred_at>=?)<c.daily_cap)`)
    .all(placement.width,placement.height,today,today,`${today}T00:00:00.000Z`) as Candidate[];
  if (!candidates.length) return NextResponse.json({ad:null},{headers});
  const total = candidates.reduce((sum,ad)=>sum+ad.priority,0);
  let draw = Math.random()*total;
  const chosen = candidates.find((ad)=>(draw-=ad.priority)<0) || candidates.at(-1)!;
  await logEvent("request",chosen.id,chosen.campaign_id,placement.id);
  const origin = request.nextUrl.origin;
  const token=signDelivery(chosen.id,placement.id);
  return NextResponse.json({ad:{id:chosen.id,name:chosen.name,imageUrl:new URL(chosen.image_url,origin).toString(),width:chosen.width,height:chosen.height,
    impressionUrl:`${origin}/api/impression?creative=${chosen.id}&placement=${placement.id}&token=${token}`,
    clickUrl:`${origin}/api/click?creative=${chosen.id}&placement=${placement.id}&token=${token}`}}, {headers});
}

export async function OPTIONS() { return new NextResponse(null,{status:204,headers:{...headers,"Access-Control-Allow-Methods":"GET, OPTIONS"}}); }
