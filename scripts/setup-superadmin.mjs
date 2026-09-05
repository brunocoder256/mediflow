#!/usr/bin/env node
// One-time bootstrap: creates the MediFlow Super Admin auth user + profile + platform_admin flag.
// Safe to re-run (idempotent). Requires SUPABASE_SECRET_KEY in env or .env.local.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const ENV_FILE = fileURLToPath(new URL('../.env.local', import.meta.url));
function env(key) {
  const found = process.env[key];
  if (found) return found;
  try {
    const raw = readFileSync(ENV_FILE, 'utf8');
    const line = raw.split('\n').find((l) => l.trim().startsWith(key + '='));
    return line ? line.slice(key.length + 1).trim() : undefined;
  } catch {
    return undefined;
  }
}

const ADMIN_EMAIL = 'brodevtech@gmail.com';
const ADMIN_PASSWORD = 'brodevsoft@mediflow';
const PLATFORM_ORG = 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a00';

const url = env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL');
const key = env('SUPABASE_SECRET_KEY') || env('SUPABASE_SERVICE_ROLE_KEY');
if (!url || !key) {
  console.error('Missing SUPABASE URL or SECRET KEY');
  process.exit(1);
}
const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  // 1) Auth user
  let authUserId;
  const { data: page } = await sb.auth.admin.listUsers({ perPage: 1000 });
  const existing = page.users.find((u) => u.email === ADMIN_EMAIL);
  if (existing) {
    authUserId = existing.id;
    console.log('Auth user exists:', authUserId);
  } else {
    const { data, error } = await sb.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: 'Super Admin', role: 'superadmin' },
    });
    if (error) throw error;
    authUserId = data.user.id;
    console.log('Auth user created:', authUserId);
  }

  // 2) Profile (platform org)
  let profileId;
  const { data: profs } = await sb.from('profiles').select('id').eq('auth_user_id', authUserId);
  if (profs && profs.length) {
    profileId = profs[0].id;
    console.log('Profile exists:', profileId);
  } else {
    const { data, error } = await sb
      .from('profiles')
      .insert({
        auth_user_id: authUserId,
        organization_id: PLATFORM_ORG,
        full_name: 'Super Admin',
        email: ADMIN_EMAIL,
        username: 'superadmin',
        status: 'active',
        is_active: true,
      })
      .select()
      .single();
    if (error) throw error;
    profileId = data.id;
    console.log('Profile created:', profileId);
  }

  // 3) platform_admins flag
  const { error: paErr } = await sb
    .from('platform_admins')
    .upsert({ user_id: profileId, is_active: true, created_by: profileId }, { onConflict: 'user_id' });
  if (paErr) throw paErr;
  console.log('platform_admins flag set for', profileId);

  // 4) Owner role for platform org (idempotent) + assignment
  const { data: perms } = await sb.from('permissions').select('id');
  const permIds = perms.map((p) => p.id);
  const { data: roles } = await sb.from('roles').select('id').eq('organization_id', PLATFORM_ORG).eq('name', 'Owner');
  let roleId = roles && roles.length ? roles[0].id : null;
  if (!roleId) {
    const { data, error } = await sb
      .from('roles')
      .insert({ organization_id: PLATFORM_ORG, name: 'Owner', description: 'Platform owner', is_system_role: true })
      .select()
      .single();
    if (error) throw error;
    roleId = data.id;
  }
  if (permIds.length) {
    const { data: existingRp } = await sb
      .from('role_permissions')
      .select('permission_id')
      .eq('role_id', roleId);
    const have = new Set((existingRp || []).map((r) => r.permission_id));
    const toAdd = permIds.filter((pid) => !have.has(pid));
    if (toAdd.length) {
      const { error } = await sb
        .from('role_permissions')
        .insert(toAdd.map((permission_id) => ({ role_id: roleId, permission_id })));
      if (error) throw error;
    }
  }
  const { data: existingUr } = await sb.from('user_roles').select('id').eq('user_id', profileId).eq('role_id', roleId);
  if (!(existingUr && existingUr.length)) {
    const { error } = await sb.from('user_roles').insert({ user_id: profileId, role_id: roleId });
    if (error) throw error;
  }
  console.log('Super Admin ready: login with', ADMIN_EMAIL);
}

main().catch((e) => {
  console.error('Setup failed:', e.message);
  process.exit(1);
});