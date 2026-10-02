import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { saveAsset } from '@/lib/assets';
export const runtime='nodejs';
export async function POST(request:NextRequest) {
  if (!await isAdmin(request)) return NextResponse.json({error:'Unauthorized'},{status:401});
  if (Number(request.headers.get('content-length') || 0) > 6 * 1024 * 1024) return NextResponse.json({error:'Image is too large'},{status:413});
  try {
    const reader=request.body?.getReader();
    if(!reader)return NextResponse.json({error:'Choose an image file'},{status:400});
    const chunks:Uint8Array[]=[];let size=0;
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>6*1024*1024){await reader.cancel();return NextResponse.json({error:'Image is too large'},{status:413});}chunks.push(value);}
    const form = await new Response(Buffer.concat(chunks),{headers:{'Content-Type':request.headers.get('content-type')||''}}).formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({error:'Choose an image file'},{status:400});
    return NextResponse.json({asset:await saveAsset(file)},{status:201});
  } catch (error) { return NextResponse.json({error:error instanceof Error ? error.message : 'Image upload failed'},{status:400}); }
}
