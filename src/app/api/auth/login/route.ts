import { NextRequest, NextResponse } from "next/server";
import { adminConfigured, cookieName, createSession, validPassword, allowLogin, sameOrigin, sessionSeconds } from "@/lib/auth";
export const runtime="nodejs";
export async function POST(request:NextRequest){
  if(!adminConfigured())return NextResponse.json({error:"Set ADMIN_PASSWORD on the server first"},{status:503});
  if(!sameOrigin(request))return NextResponse.json({error:'Invalid origin'},{status:403});
  if(!await allowLogin(request))return NextResponse.json({error:'Too many login attempts. Try again in 15 minutes.'},{status:429,headers:{'Retry-After':'900'}});
  const body=await request.json().catch(()=>({}));
  if(!validPassword(String(body.password||"")))return NextResponse.json({error:"Incorrect password"},{status:401});
  const response=NextResponse.json({ok:true});
  response.cookies.set(cookieName,await createSession(),{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/",maxAge:sessionSeconds});
  return response;
}
