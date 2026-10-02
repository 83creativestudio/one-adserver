import { NextRequest,NextResponse } from 'next/server';
import { recordDelivery } from '@/lib/delivery';
export const runtime='nodejs';
export async function GET(request:NextRequest){
 const row=await recordDelivery(request.nextUrl.searchParams.get('request')||'',request.nextUrl.searchParams.get('token')||'','click');
 if(!row || !/^https?:\/\//i.test(row.target_url))return new NextResponse('Ad not found',{status:404});
 return NextResponse.redirect(row.target_url,{status:302,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
}
