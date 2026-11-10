import { NextResponse } from "next/server";
import { cachedMetrics } from "@/lib/metrics-cache";
import { NextRequest } from "next/server";
import { isAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export async function GET(request:NextRequest) { return await isAdmin(request)?NextResponse.json(await cachedMetrics(),{headers:{'Cache-Control':'private, no-store'}}):NextResponse.json({error:"Unauthorized"},{status:401}); }
