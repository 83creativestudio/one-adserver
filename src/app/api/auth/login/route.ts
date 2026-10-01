import { NextRequest, NextResponse } from "next/server";
import { adminConfigured, cookieName, sessionToken, validPassword } from "@/lib/auth";
export const runtime="nodejs";
export async function POST(request:NextRequest){
  if(!adminConfigured())return NextResponse.json({error:"Set ADMIN_PASSWORD on the server first"},{status:503});
  const body=await request.json().catch(()=>({}));
  if(!validPassword(String(body.password||"")))return NextResponse.json({error:"Incorrect password"},{status:401});
  const response=NextResponse.json({ok:true});
  response.cookies.set(cookieName,sessionToken(),{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/",maxAge:60*60*24*7});
  return response;
}
