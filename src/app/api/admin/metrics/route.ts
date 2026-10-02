import { NextResponse } from "next/server";
import { metrics } from "@/lib/store";
import { NextRequest } from "next/server";
import { isAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export async function GET(request:NextRequest) { return await isAdmin(request)?NextResponse.json(await metrics()):NextResponse.json({error:"Unauthorized"},{status:401}); }
