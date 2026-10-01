import { NextRequest, NextResponse } from "next/server";
import { remove, resources, update, type Resource } from "@/lib/store";
import { isAdmin } from "@/lib/auth";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest, context: {params: Promise<{resource:string;id:string}>}) {
  if(!isAdmin(request))return NextResponse.json({error:"Unauthorized"},{status:401});
  const {resource,id} = await context.params;
  if (!resources.includes(resource as Resource)) return NextResponse.json({error:"Unknown resource"}, {status:404});
  try {
    const item = await update(resource as Resource,id,await request.json());
    return item ? NextResponse.json({item}) : NextResponse.json({error:"Not found"},{status:404});
  } catch (error) { return NextResponse.json({error:error instanceof Error ? error.message : "Could not update record"},{status:400}); }
}

export async function DELETE(request: NextRequest, context: {params: Promise<{resource:string;id:string}>}) {
  if(!isAdmin(request))return NextResponse.json({error:"Unauthorized"},{status:401});
  const {resource,id} = await context.params;
  if (!resources.includes(resource as Resource)) return NextResponse.json({error:"Unknown resource"}, {status:404});
  return await remove(resource as Resource,id) ? NextResponse.json({ok:true}) : NextResponse.json({error:"Not found"},{status:404});
}
