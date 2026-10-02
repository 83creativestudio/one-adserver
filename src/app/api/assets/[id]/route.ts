import { readAsset } from '@/lib/assets';
export const runtime='nodejs';
export async function GET(_request:Request, context:{params:Promise<{id:string}>}) {
  const asset=await readAsset((await context.params).id);
  if (!asset) return new Response('Not found',{status:404});
  return new Response(new Uint8Array(asset.bytes),{headers:{'Content-Type':asset.contentType,'X-Content-Type-Options':'nosniff','Cache-Control':'public,max-age=31536000,immutable','Access-Control-Allow-Origin':'*'}});
}
