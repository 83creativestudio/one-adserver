import { NextRequest, NextResponse } from "next/server";
import { recordDelivery } from "@/lib/delivery";
export const runtime = "nodejs";
const pixel = Uint8Array.from([71,73,70,56,57,97,1,0,1,0,128,0,0,0,0,0,255,255,255,33,249,4,1,0,0,0,0,44,0,0,0,0,1,0,1,0,0,2,2,68,1,0,59]);
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("request") || "";
  const token = request.nextUrl.searchParams.get("token") || "";
  await recordDelivery(id,token,'impression');
  return new NextResponse(pixel,{headers:{"Content-Type":"image/gif","Cache-Control":"no-store","Access-Control-Allow-Origin":"*"}});
}
