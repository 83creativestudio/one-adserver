import { NextRequest, NextResponse } from 'next/server';
import { servePlacement } from '@/lib/delivery';
import { signDelivery } from '@/lib/delivery-token';
export const runtime='nodejs';
const headers={'Access-Control-Allow-Origin':'*','Cache-Control':'no-store'};
export async function GET(request:NextRequest) {
  const id=request.nextUrl.searchParams.get('placement');
  if(!id)return NextResponse.json({error:'placement is required'},{status:400,headers});
  const ad=await servePlacement(id);
  if(ad===undefined)return NextResponse.json({error:'Placement not found'},{status:404,headers});
  if(!ad)return NextResponse.json({ad:null},{headers});
  const origin=process.env.APP_URL || request.nextUrl.origin;
  const query=`request=${ad.requestId}&token=${signDelivery(ad.requestId)}`;
  return NextResponse.json({ad:{id:ad.id,name:ad.name,width:ad.width,height:ad.height,imageUrl:new URL(ad.image_url,origin).href,impressionUrl:`${origin}/api/impression?${query}`,clickUrl:`${origin}/api/click?${query}`}},{headers});
}
export async function OPTIONS(){return new NextResponse(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'GET, OPTIONS'}});}
