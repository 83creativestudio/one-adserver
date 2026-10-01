import { NextRequest, NextResponse } from "next/server";
import { db, logEvent } from "@/lib/store";
import { verifyDelivery } from "@/lib/delivery-token";
export const runtime = "nodejs";
const pixel = Uint8Array.from([71,73,70,56,57,97,1,0,1,0,128,0,0,0,0,0,255,255,255,33,249,4,1,0,0,0,0,44,0,0,0,0,1,0,1,0,0,2,2,68,1,0,59]);
export async function GET(request: NextRequest) {
  const creative = request.nextUrl.searchParams.get("creative") || "";
  const placement = request.nextUrl.searchParams.get("placement") || "";
  const token = request.nextUrl.searchParams.get("token") || "";
  const row = await db().prepare("SELECT cr.id,cr.campaign_id FROM creatives cr JOIN placements p ON p.width=cr.width AND p.height=cr.height WHERE cr.id=? AND p.id=?").get(creative,placement) as {id:string;campaign_id:string}|undefined;
  if (row && verifyDelivery(creative,placement,token)) await logEvent("impression",row.id,row.campaign_id,placement);
  return new NextResponse(pixel,{headers:{"Content-Type":"image/gif","Cache-Control":"no-store","Access-Control-Allow-Origin":"*"}});
}
