import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { updateUser } from '@/lib/users';
export const runtime = 'nodejs';
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await currentUser(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || (body.username !== undefined && typeof body.username !== 'string') || (body.password !== undefined && typeof body.password !== 'string')) return NextResponse.json({ error: 'Invalid user details' }, { status: 400 });
  const { id } = await context.params;
  try {
    const item = await updateUser(id, { username: body.username?.trim(), password: body.password });
    return item ? NextResponse.json({ item }) : NextResponse.json({ error: 'User not found' }, { status: 404 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not update user' }, { status: 400 }); }
}
