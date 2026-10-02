import { NextResponse } from 'next/server';
import { db } from '@/lib/store';
export const dynamic='force-dynamic';
export async function GET(){
 try{
  await db().prepare('SELECT 1 AS ok').get();
  if(process.env.NODE_ENV==='production' && (!process.env.ADMIN_PASSWORD || !process.env.DELIVERY_SECRET || !process.env.APP_URL))throw new Error('Missing production configuration');
  return NextResponse.json({status:'ok'},{headers:{'Cache-Control':'no-store'}});
 }catch{ return NextResponse.json({status:'unavailable'},{status:503,headers:{'Cache-Control':'no-store'}}); }
}
