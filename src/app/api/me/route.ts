import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getEffectivePermissions, getUserBranches } from '@/lib/auth';
import { sanitizeError } from '@/lib/security';
import { normalizePreferences } from '@/lib/preferences';

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
      .select('*')
      .eq('auth_user_id', user.id)
      .single();
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    const permissions = await getEffectivePermissions(sb, profile.id, profile.organization_id);
    const branchIds = await getUserBranches(sb, profile.id);

    const { data: urs } = await sb.from('user_roles').select('role_id, roles(id, name)').eq('user_id', profile.id);
    const { data: branches } = branchIds.length
      ? await sb.from('branches').select('id, name, code').in('id', branchIds)
      : { data: [] };

    // Organization operating region + regional defaults (used for regional
    // display such as the country flag and locale-aware formatting).
    let countryCode: string | null = null;
    let orgCurrency: string | null = null;
    let orgLocale: string | null = null;
    let orgTimezone: string | null = null;
    if (profile.organization_id) {
      const { data: org } = await sb
        .from('organizations')
        .select('*')
        .eq('id', profile.organization_id)
        .maybeSingle();
      countryCode = (org as any)?.country ?? null;
      orgCurrency = (org as any)?.currency ?? null;
      orgLocale = (org as any)?.locale ?? null;
      orgTimezone = (org as any)?.timezone ?? null;
    }

    return NextResponse.json({
      ...profile,
      email: profile.email || user.email,
      roles: (urs ?? []).map((u: any) => u.roles?.name).filter(Boolean),
      role_ids: (urs ?? []).map((u: any) => u.role_id),
      permissions: [...permissions],
      branch_ids: branchIds,
      branches: branches ?? [],
      // Personal interface preferences
      preferences: normalizePreferences(profile),
      // Organization-wide regional settings (read-only; currency is authoritative)
      country_code: countryCode,
      org_currency: orgCurrency,
      org_locale: orgLocale,
      org_timezone: orgTimezone,
    });
  } catch (e: any) {
    console.error('[me] error:', e?.message);
    return NextResponse.json({ error: sanitizeError(e?.message ?? '') }, { status: 500 });
  }
}
