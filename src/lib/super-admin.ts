// Shared helpers for the Super Admin module.
// Enforces that the caller is a platform Super Admin on every request.
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

const PLATFORM_ORG = 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a00';

export async function isSuperAdmin(sb: any): Promise<boolean> {
  try {
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) return false;
    const { data } = await sb.rpc('is_super_admin');
    return data === true;
  } catch {
    return false;
  }
}

/** Return the calling Super Admin's own profile id (via service role). */
export async function superAdminProfileId(sb: any): Promise<string | null> {
  const admin = createAdminSupabaseClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await admin.from('profiles').select('id').eq('auth_user_id', user.id).single();
  return data?.id ?? null;
}

/** Record a platform-scoped audit entry (always service role). */
export async function platformAudit(
  actorProfileId: string,
  opts: {
    action: string;
    entityType: string;
    entityId?: string | null;
    oldValues?: Record<string, unknown> | null;
    newValues?: Record<string, unknown> | null;
  },
): Promise<void> {
  const admin = createAdminSupabaseClient();
  await admin.from('audit_logs').insert({
    organization_id: PLATFORM_ORG,
    user_id: actorProfileId,
    created_by: actorProfileId,
    action: opts.action,
    entity_type: opts.entityType,
    entity_id: opts.entityId ?? null,
    old_values: opts.oldValues ?? null,
    new_values: opts.newValues ?? null,
    branch_id: null,
  });
}

export { PLATFORM_ORG };