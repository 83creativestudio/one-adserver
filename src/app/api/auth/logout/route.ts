import { NextResponse } from "next/server";
import { cookieName, revokeSession, sameOrigin } from "@/lib/auth";
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Invalid origin'},{status:403});
 await revokeSession(request);
 const response=NextResponse.json({ok:true});response.cookies.delete(cookieName);return response;
}
