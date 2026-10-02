import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";

export async function proxy(request:NextRequest){
  if(await isAdmin(request))return NextResponse.next();
  return NextResponse.redirect(new URL("/login",request.url));
}

export const config={matcher:["/((?!api|login|_next|ad.js|favicon.ico|images).*)"]};
