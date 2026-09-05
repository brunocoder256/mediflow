#!/usr/bin/env node
// E2E for the Super Admin module against a live dev server + remote Supabase.
// 1) Public Create Account -> /api/register          (201, duplicate -> 409, invalid -> 400)
// 2) Super Admin lists registrations via /api/super-admin/accounts (superauth cookie)
// 3) Approve via the real route -> auto-creates org/branch/login/profile/roles/audit
// 4) Owner login works and get_my_org_status = active; not a super admin
// 5) Suspend -> org suspended (owner blocked); activate back
// Run: node scripts/e2e-register-approve.mjs   (assumes dev server on localhost:3333)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

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

const BASE = process.env.BASE || 'http://localhost:3333';
const URL_ = env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL');
const ANON = env('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') || env('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const SECRET = env('SUPABASE_SECRET_KEY') || env('SUPABASE_SERVICE_ROLE_KEY');
const ADMIN_EMAIL = 'brodevtech@gmail.com';
const ADMIN_PASSWORD = 'brodevsoft@mediflow';
const PLATFORM_ORG = 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a00';

if (!BASE || !URL_ || !ANON || !SECRET) {
  console.error('Missing env (BASE, SUPABASE_URL/KEY needed)');
  process.exit(1);
}

const service = createClient(URL_, SECRET, { auth: { autoRefreshToken: false, persistSession: false } });

let pass = 0;
let fail = 0;
function check(label, cond, extra = '') {
  if (cond) {
    pass++;
    console.log(`  ok   ${label}${extra ? ` (${extra})` : ''}`);
  } else {
    fail++;
    console.log(`  FAIL ${label}${extra ? ` (${extra})` : ''}`);
  }
}

async function api(url, opts = {}) {
  const res = await fetch(url, opts);
  const j = await res.json().catch(() => ({}));
  return { status: res.status, json: j };
}

// Build an @supabase/ssr browser-like client that captures cookies, so we can
// authenticate HTTP calls the same way the real browser does (middleware path).
function sessionClient() {
  let jar = [];
  return {
    getCookieHeader() {
      if (!jar.length) return '';
      return jar.map((c) => `${c.name}=${encodeURIComponent(c.value)}`).join('; ');
    },
    client() {
      const store = {
        getAll: () => jar,
        setAll: (cookies) => {
          jar = cookies.map(({ name, value, options }) => ({ name, value }));
        },
      };
      return createServerClient(URL_, ANON, { cookies: store });
    },
  };
}

async function signInAs(email, password) {
  const s = sessionClient();
  const { data, error } = await s.client().auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`signIn ${email}: ${error?.message || 'no session'}`);
  return { session: data.session, cookie: s.getCookieHeader() };
}

async function main() {
  const stamp = Date.now();
  const uniq = `e2e${stamp % 1000000000}`;
  const email = `owner.${uniq}@gmail.com`;
  const payload = {
    business_name: `E2E Pharmacy ${uniq}`,
    business_type: 'pharmacy',
    owner_full_name: 'E2E Owner',
    owner_email: email,
    owner_phone: '+256700000000',
    location: 'Kampala, Uganda',
  };

  console.log('== 1) Public Create Account -> /api/register ==');
  const r1 = await api(`${BASE}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  check('register returns 201', r1.status === 201, `status=${r1.status}`);
  const reg = r1.json?.registration;
  check('returns registration data', !!reg?.id && !!reg?.reference?.startsWith('MF-'), reg?.reference || 'n/a');

  const r2 = await api(`${BASE}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  check('duplicate email returns 409', r2.status === 409, `status=${r2.status}`);

  const r3 = await api(`${BASE}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, owner_email: 'not-an-email' }),
  });
  check('invalid payload returns 400', r3.status === 400, `status=${r3.status}`);

  console.log('== 2) Super Admin login + list ==');
  const admin = await signInAs(ADMIN_EMAIL, ADMIN_PASSWORD);
  check('super admin signs in', !!admin.session, admin.session?.user?.email || 'n/a');

  const listAll = await api(`${BASE}/api/super-admin/accounts?status=pending`, {
    headers: { Cookie: admin.cookie },
  });
  check('list route reachable as super admin', listAll.status === 200, `status=${listAll.status}`);
  const myReg = (listAll.json?.data || []).find((x) => x.id === reg.id);
  check('pending registration visible to super admin', !!myReg && myReg.status === 'pending');

  const unauthed = await api(`${BASE}/api/super-admin/accounts`);
  check('no cookie -> 401/403 from list route', unauthed.status === 401 || unauthed.status === 403, `status=${unauthed.status}`);
  // listAll.json.counts should reflect at least one pending
  check('KPI counts present', typeof listAll.json?.counts?.pending === 'number', `pending=${listAll.json?.counts?.pending}`);

  console.log('== 3) Approve (auto-creates the account) ==');
  const appr = await api(`${BASE}/api/super-admin/accounts/${reg.id}/approve`, {
    method: 'POST',
    headers: { Cookie: admin.cookie },
  });
  check('approve returns ok', appr.status === 200 && appr.json?.ok === true, `status=${appr.status}`);
  const orgId = appr.json?.account?.organization_id;
  const loginEmail = appr.json?.login?.email;
  check('approve returns organization id', !!orgId);
  check('approve returns owner login email', loginEmail === email, loginEmail || 'n/a');

  const org = await service.from('organizations').select('*').eq('id', orgId).single();
  check('organization created & active', org.data?.status === 'active' && org.data?.name === payload.business_name, org.data?.name || org.error?.message);
  const branches = await service.from('branches').select('*').eq('organization_id', orgId);
  check('main branch created', branches.data?.length === 1, branches.data?.[0]?.name || 'none');

  const { data: authUser } = await service.auth.admin.listUsers({ perPage: 1000 });
  const ownerAuth = authUser.users.find((u) => u.email === email);
  check('owner auth user created', !!ownerAuth);
  const profiles = await service.from('profiles').select('*').eq('auth_user_id', ownerAuth?.id);
  const ownerProfile = profiles.data?.[0];
  check('owner profile created in org', !!ownerProfile && ownerProfile.organization_id === orgId && ownerProfile.is_active === true);
  const roles = await service.from('roles').select('*').eq('organization_id', orgId);
  const ownerRole = roles.data?.find((x) => x.name === 'Owner');
  check('Owner role created', !!ownerRole);
  const rp = await service.from('role_permissions').select('*').eq('role_id', ownerRole?.id);
  const perms = await service.from('permissions').select('id');
  check('Owner role has all permissions', rp.data?.length === perms.data?.length, `${rp.data?.length}/${perms.data?.length}`);
  const ur = await service.from('user_roles').select('*').eq('user_id', ownerProfile?.id);
  check('owner has Owner role', ur.data?.length === 1 && ur.data?.[0]?.role_id === ownerRole?.id);
  const ub = await service.from('user_branches').select('*').eq('user_id', ownerProfile?.id);
  check('owner assigned to main branch (default)', ub.data?.length === 1 && ub.data?.[0]?.is_default === true, ub.data?.[0]?.branch_id || 'none');
  const oset = await service.from('organization_settings').select('*').eq('organization_id', orgId);
  check('default org settings created', oset.data?.length === 1, `tax=${oset.data?.[0]?.default_tax_rate}`);
  const audit = await service.from('audit_logs').select('*').eq('entity_type', 'registrations').eq('organization_id', PLATFORM_ORG);
  const actions = audit.data?.map((a) => a.action) || [];
  check('audit has ACCOUNT_APPLIED', actions.includes('ACCOUNT_APPLIED'));
  check('audit has ACCOUNT_APPROVED', actions.includes('ACCOUNT_APPROVED'), `actor=${audit.data?.find((a) => a.action === 'ACCOUNT_APPROVED')?.user_id || 'none'}`);

  console.log('== 4) Owner login + gating ==');
  let ownerPw = appr.json?.login?.provisionalPassword;
  if (!ownerPw) {
    ownerPw = `MFtest@${stamp}`;
    const { error } = await service.auth.admin.updateUserById(ownerAuth.id, { password: ownerPw, email_confirm: true });
    check('set owner password (no provisional from invite)', !error, error?.message || '');
  } else {
    check('provisional password was returned', /^MF@[0-9a-f]{10}$/.test(ownerPw), ownerPw);
  }
  const owner = await signInAs(email, ownerPw);
  check('owner can sign in with returned password', !!owner.session);
  // Recreate the owner's session in an in-memory client so RPC calls run as the owner.
  const ownClient = sessionClient();
  await ownClient.client().auth.setSession({
    access_token: owner.session.access_token,
    refresh_token: owner.session.refresh_token,
  });
  const stat = await ownClient.client().rpc('get_my_org_status');
  check('owner org status = active', stat.data === 'active', stat.data || 'n/a');
  const isAdmin = await ownClient.client().rpc('is_super_admin');
  check('owner is NOT a super admin', isAdmin.data === false, String(isAdmin.data));

  const ownerOnAdminRoute = await api(`${BASE}/api/super-admin/accounts`, { headers: { Cookie: owner.cookie } });
  check('owner blocked from super admin API (403)', ownerOnAdminRoute.status === 403, `status=${ownerOnAdminRoute.status}`);

  console.log('== 5) Suspend / Activate ==');
  const susp = await api(`${BASE}/api/super-admin/accounts/${reg.id}/suspend`, {
    method: 'POST',
    headers: { Cookie: admin.cookie },
  });
  check('suspend returns ok', susp.status === 200 && susp.json?.ok === true, `status=${susp.status}`);
  const suspendedOrg = await service.from('organizations').select('status').eq('id', orgId).single();
  check('organization now suspended', suspendedOrg.data?.status === 'suspended', suspendedOrg.data?.status || 'n/a');
  const statSusp = await ownClient.client().rpc('get_my_org_status');
  check('owner gated (status = suspended)', statSusp.data === 'suspended', statSusp.data || 'n/a');

  const act = await api(`${BASE}/api/super-admin/accounts/${reg.id}/activate`, {
    method: 'POST',
    headers: { Cookie: admin.cookie },
  });
  check('activate returns ok', act.status === 200 && act.json?.ok === true, `status=${act.status}`);
  const activeOrg = await service.from('organizations').select('status').eq('id', orgId).single();
  check('organization active again', activeOrg.data?.status === 'active', activeOrg.data?.status || 'n/a');

  // Rejected flow check (registers a second applicant and rejects it)
  console.log('== 6) Reject flow ==');
  const email2 = `owner.reject${stamp}@gmail.com`;
  const r4 = await api(`${BASE}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, business_name: `E2E Rejected Pharmacy ${uniq}`, owner_full_name: 'Reject Owner', owner_email: email2 }),
  });
  const reg2 = r4.json?.registration;
  check('second registration created', !!reg2?.id);
  const rej = await api(`${BASE}/api/super-admin/accounts/${reg2.id}/reject`, {
    method: 'POST',
    headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'E2E test rejection' }),
  });
  check('reject returns ok', rej.status === 200 && rej.json?.ok === true, `status=${rej.status}`);
  const rejReg = await service.from('registrations').select('*').eq('id', reg2.id).single();
  check('registration rejected with reason', rejReg.data?.status === 'rejected' && rejReg.data?.rejection_reason === 'E2E test rejection');

  console.log(`\nResult: ${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error('E2E error:', e.message);
  process.exit(1);
});