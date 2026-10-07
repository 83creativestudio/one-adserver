import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  const user = await currentUser(request);
  return user ? NextResponse.json({ user }) : NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
