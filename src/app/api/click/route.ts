import { NextRequest, NextResponse } from "next/server";
import { db, logEvent } from "@/lib/store";
import { verifyDelivery } from "@/lib/delivery-token";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const creative = request.nextUrl.searchParams.get("creative") || "";
  const placement = request.nextUrl.searchParams.get("placement") || "";
  const token = request.nextUrl.searchParams.get("token") || "";
  const row = await db().prepare("SELECT cr.id,cr.campaign_id,cr.target_url FROM creatives cr JOIN placements p ON p.width=cr.width AND p.height=cr.height WHERE cr.id=? AND p.id=?").get(creative,placement) as {id:string;campaign_id:string;target_url:string}|undefined;
  if (!row || !verifyDelivery(creative,placement,token) || !/^https?:\/\//i.test(row.target_url)) return new NextResponse("Ad not found",{status:404});
  await logEvent("click",row.id,row.campaign_id,placement);
  return NextResponse.redirect(row.target_url,302);
}
