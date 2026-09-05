import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getEffectivePermissions, getUserBranches } from '@/lib/auth';

/** Current authenticated user profile + effective permissions + branches (for nav/RBAC). */
export async function GET() {
  try {
    const sb: any = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const { data: profile } = await sb
      .from('profiles')
      .select(
        'id, full_name, email, phone, avatar_url, status, is_active, organization_id, default_branch_id, last_login_at',
      )
      .eq('auth_user_id', user.id)
      .single();
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    const permissions = await getEffectivePermissions(sb, profile.id, profile.organization_id);
    const branchIds = await getUserBranches(sb, profile.id);

    const { data: urs } = await sb.from('user_roles').select('role_id, roles(id, name)').eq('user_id', profile.id);
    const { data: branches } = branchIds.length
      ? await sb.from('branches').select('id, name, code').in('id', branchIds)
      : { data: [] };

    return NextResponse.json({
      ...profile,
      email: profile.email || user.email,
      roles: (urs ?? []).map((u: any) => u.roles?.name).filter(Boolean),
      role_ids: (urs ?? []).map((u: any) => u.role_id),
      permissions: [...permissions],
      branch_ids: branchIds,
      branches: branches ?? [],
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
