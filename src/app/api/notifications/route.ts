import { NextResponse } from 'next/server';
import { getSB } from '@/lib/services/supabase';
import {
  syncInventoryNotifications,
  getNotificationsForUser,
  markNotificationRead,
} from '@/lib/services/notifications';

async function getAuthProfile() {
  const sb: any = await getSB();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: prof } = await sb
    .from('profiles')
    .select('id, organization_id')
    .eq('auth_user_id', user.id)
    .single();
  if (!prof) return null;
  return { user, profile: prof };
}

export async function GET(req: Request) {
  try {
    const auth = await getAuthProfile();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const branchId = new URL(req.url).searchParams.get('branch_id');
    // Refresh alerts from authoritative data so the bell is live.
    await syncInventoryNotifications(auth.profile.organization_id, branchId).catch(() => null);
    const data = await getNotificationsForUser(auth.profile.id);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await getAuthProfile();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const id = typeof body.id === 'string' ? body.id : undefined;
    const all = body.all === true;
    const res = await markNotificationRead(auth.profile.id, id, all);
    if (!res.ok) return NextResponse.json({ error: res.error ?? 'Failed to update' }, { status: 400 });
    const data = await getNotificationsForUser(auth.profile.id);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}