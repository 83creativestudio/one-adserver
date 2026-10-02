import { NextRequest, NextResponse } from "next/server";
import { create, list, resources, type Resource } from "@/lib/store";
import { isAdmin } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: {params: Promise<{resource:string}>}) {
  if(!await isAdmin(request))return NextResponse.json({error:"Unauthorized"},{status:401});
  const {resource} = await context.params;
  if (!resources.includes(resource as Resource)) return NextResponse.json({error:"Unknown resource"}, {status:404});
  return NextResponse.json({items:await list(resource as Resource)});
}

export async function POST(request: NextRequest, context: {params: Promise<{resource:string}>}) {
  if(!await isAdmin(request))return NextResponse.json({error:"Unauthorized"},{status:401});
  const {resource} = await context.params;
  if (!resources.includes(resource as Resource)) return NextResponse.json({error:"Unknown resource"}, {status:404});
  try { return NextResponse.json({item:await create(resource as Resource, await request.json())}, {status:201}); }
  catch (error) { return NextResponse.json({error:error instanceof Error ? error.message : "Could not create record"}, {status:400}); }
}
