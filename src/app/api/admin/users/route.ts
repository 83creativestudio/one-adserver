import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { createUser, listUsers } from '@/lib/users';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  if (!await currentUser(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ items: await listUsers() });
}
export async function POST(request: Request) {
  if (!await currentUser(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.username !== 'string' || typeof body.password !== 'string') return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
  try { return NextResponse.json({ item: await createUser(body.username.trim(), body.password) }, { status: 201 }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not create user' }, { status: 400 }); }
}
