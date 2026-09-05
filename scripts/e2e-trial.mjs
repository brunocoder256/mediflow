#!/usr/bin/env node
// E2E for the 3-day free trial module against a live dev server + remote Supabase.
// 1) Register -> approve -> org in 'trial' with ~3-day deadline
// 2) Owner login -> /api/trial active + banner data (phones, days)
// 3) Force-expire -> lazy flip to trial_expired; /dashboard redirects to /trial-expired
// 4) Data API rejects while expired; /trial-expired page serves
// 5) Super Admin: extend trial -> owner back in; grant full -> permanent
// Run: node scripts/e2e-trial.mjs   (assumes dev server on localhost:3333)
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
  return { status: res.status, json: j, redirected: res.redirected, finalUrl: res.url };
}

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
  const uniq = `trial${stamp % 1000000000}`;
  const email = `owner.${uniq}@gmail.com`;
  const payload = {
    business_name: `Trial E2E ${uniq}`,
    business_type: 'pharmacy',
    owner_full_name: 'Trial Owner',
    owner_email: email,
    owner_phone: '+256700000005',
    location: 'Kampala, Uganda',
  };

  console.log('== 1) Register + approve (trial starts) ==');
  const r1 = await api(`${BASE}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  check('register returns 201', r1.status === 201, `status=${r1.status}`);
  const regId = r1.json?.registration?.id;
  check('registration id present', !!regId);

  const admin = await signInAs(ADMIN_EMAIL, ADMIN_PASSWORD);
  const appr = await api(`${BASE}/api/super-admin/accounts/${regId}/approve`, {
    method: 'POST',
    headers: { Cookie: admin.cookie },
  });
  check('approve returns ok', appr.status === 200 && appr.json?.ok === true, `status=${appr.status}`);
  check('approve marks plan trial', appr.json?.account?.plan === 'trial', appr.json?.account?.plan || 'n/a');
  const orgId = appr.json?.account?.organization_id;
  const login = appr.json?.login;
  check('login + provisional password', !!login?.email && !!login?.provisionalPassword);
  const ownerEmail = login.email;
  const ownerPass = login.provisionalPassword;

  const orgRow = (await service.from('organizations').select('plan,trial_ends_at,status').eq('id', orgId).single()).data;
  check('org stored plan=trial', orgRow?.plan === 'trial', orgRow?.plan || 'n/a');
  const deadline = orgRow?.trial_ends_at ? new Date(orgRow.trial_ends_at).getTime() : 0;
  const diffDays = (deadline - Date.now()) / 86400000;
  check('trial deadline is ~3 days ahead', diffDays > 2.5 && diffDays < 3.5, `${diffDays.toFixed(2)} days`);

  console.log('== 2) Owner sign-in during trial ==');
  const owner = await signInAs(ownerEmail, ownerPass);
  check('owner signs in', !!owner.session);

  const gate = await api(`${BASE}/api/trial`, { headers: { Cookie: owner.cookie } });
  check('/api/trial returns active trial', gate.json?.status === 'active' && gate.json?.plan === 'trial', `status=${gate.json?.status}`);
  check('banner data present (days + phones)', gate.json?.trial_days === 3 && gate.json?.contact_phone_1 === '0759327843' && gate.json?.contact_phone_2 === '0768082948', `${gate.json?.contact_phone_1}/${gate.json?.contact_phone_2}`);

  const dash = await fetch(`${BASE}/dashboard`, { headers: { Cookie: owner.cookie }, redirect: 'manual' });
  check('GET /dashboard allowed during trial', dash.status === 200, `status=${dash.status}`);

  console.log('== 3) Trial expires -> block screen ==');
  const { error: expErr } = await service
    .from('organizations')
    .update({ trial_ends_at: new Date(Date.now() - 3600 * 1000).toISOString() })
    .eq('id', orgId);
  check('forced trial_ends_at to the past', !expErr, expErr?.message || '');

  const gateAfter = await api(`${BASE}/api/trial`, { headers: { Cookie: owner.cookie } });
  check('lazy flip -> trial_expired', gateAfter.json?.status === 'trial_expired', `status=${gateAfter.json?.status}`);

  const dashExpired = await fetch(`${BASE}/dashboard`, { headers: { Cookie: owner.cookie }, redirect: 'manual' });
  check('dashboard redirects to /trial-expired', (dashExpired.status === 307 || dashExpired.status === 308) && (dashExpired.headers.get('location') || '').includes('/trial-expired'), `status=${dashExpired.status} loc=${dashExpired.headers.get('location')}`);

  const blockPage = await fetch(`${BASE}/trial-expired`, { headers: { Cookie: owner.cookie } });
  check('block screen serves 200', blockPage.status === 200, `status=${blockPage.status}`);

  const cashApi = await api(`${BASE}/api/cash/sessions?current=true`, { headers: { Cookie: owner.cookie } });
  check('data API rejects while expired', cashApi.status !== 200, `status=${cashApi.status}`);

  const adminList = await api(`${BASE}/api/super-admin/accounts?status=trial_expired`, { headers: { Cookie: admin.cookie } });
  check('super admin sees trial_expired account', Array.isArray(adminList.json?.data) && adminList.json.data.some((r) => r.id === regId), `count=${adminList.json?.data?.length}`);
  check('trial_expired KPI counted', (adminList.json?.counts?.trial_expired ?? 0) >= 1, `trial_expired=${adminList.json?.counts?.trial_expired}`);

  console.log('== 4) Super Admin extends trial ==');
  const ext = await api(`${BASE}/api/super-admin/accounts/${regId}/extend-trial`, {
    method: 'POST',
    headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ trial_days: 5 }),
  });
  check('extend returns ok', ext.status === 200 && ext.json?.ok && ext.json?.trial_days === 5, `status=${ext.status}`);
  check('org active again on trial', ext.json?.status === 'active' && ext.json?.plan === 'trial');

  const gateBack = await api(`${BASE}/api/trial`, { headers: { Cookie: owner.cookie } });
  check('owner trial active again', gateBack.json?.status === 'active' && gateBack.json?.plan === 'trial', `status=${gateBack.json?.status}`);
  const dashBack = await fetch(`${BASE}/dashboard`, { headers: { Cookie: owner.cookie }, redirect: 'manual' });
  check('dashboard access restored', dashBack.status === 200, `status=${dashBack.status}`);

  console.log('== 5) Super Admin grants full access ==');
  const grant = await api(`${BASE}/api/super-admin/accounts/${regId}/grant-full`, {
    method: 'POST',
    headers: { Cookie: admin.cookie },
  });
  check('grant returns ok', grant.status === 200 && grant.json?.ok, `status=${grant.status}`);
  check('plan becomes full', grant.json?.plan === 'full', grant.json?.plan || 'n/a');

  const gateFull = await api(`${BASE}/api/trial`, { headers: { Cookie: owner.cookie } });
  check('owner plan full + no deadline', gateFull.json?.plan === 'full' && gateFull.json?.trial_ends_at == null, `plan=${gateFull.json?.plan}`);
  check('status active', gateFull.json?.status === 'active', gateFull.json?.status || 'n/a');

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error('E2E crashed:', e);
  process.exit(1);
});