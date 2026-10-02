import { NextResponse } from 'next/server';
import { isAdmin,revokeSession,cookieName } from '@/lib/auth';
export async function POST(request:Request){
 if(!await isAdmin(request))return NextResponse.json({error:'Unauthorized'},{status:401});
 await revokeSession(request,true);
 const response=NextResponse.json({ok:true});response.cookies.delete(cookieName);return response;
}
