#!/usr/bin/env node
// E2E for the new /cash Cash Management page + API against a live dev server.
// 1) Register pharmacy -> super admin approves (provisional password)
// 2) Owner signs in; /cash page + /api/cash?registers=1 resolve
// 3) Create a cash register (if none) for the owner's branch
// 4) Open cash session -> current=true returns it -> summary -> movement -> close -> CLOSED
// Run: node scripts/e2e-cash-session.mjs   (assumes dev server on localhost:3333)
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
  return { status: res.status, json: j };
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
  const uniq = `cash${stamp % 1000000000}`;
  const email = `owner.${uniq}@gmail.com`;
  const payload = {
    business_name: `Cash E2E ${uniq}`,
    business_type: 'pharmacy',
    owner_full_name: 'Cash E2E Owner',
    owner_email: email,
    owner_phone: '+256700000001',
    location: 'Kampala, Uganda',
  };

  console.log('== 1) Register + approve as super admin ==');
  const r1 = await api(`${BASE}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  check('register returns 201', r1.status === 201, `status=${r1.status}`);
  const regId = r1.json?.registration?.id;
  const regRef = r1.json?.registration?.reference;
  check('registration id present', !!regId, regRef || 'n/a');

  const admin = await signInAs(ADMIN_EMAIL, ADMIN_PASSWORD);
  check('super admin signs in', !!admin.session);

  const appr = await api(`${BASE}/api/super-admin/accounts/${regId}/approve`, {
    method: 'POST',
    headers: { Cookie: admin.cookie },
  });
  check('approve returns ok', appr.status === 200 && appr.json?.ok === true, `status=${appr.status}`);
  const login = appr.json?.login;
  check('owner login email + password provided', !!login?.email && !!login?.provisionalPassword, login?.email || 'n/a');
  const ownerEmail = login.email;
  const ownerPass = login.provisionalPassword;

  console.log('== 2) Owner signs in; /cash routes resolve ==');
  const owner = await signInAs(ownerEmail, ownerPass);
  check('owner signs in with provisional password', !!owner.session, owner.session?.user?.email || 'n/a');

  const cashPage = await fetch(`${BASE}/cash`, { headers: { Cookie: owner.cookie }, redirect: 'follow' });
  check('GET /cash serves 200 (no more 404)', cashPage.status === 200, `status=${cashPage.status}`);
  const cashApi = await api(`${BASE}/api/cash?registers=1`);
  check('GET /api/cash?registers=1 returns array', cashApi.status === 200 && Array.isArray(cashApi.json), `status=${cashApi.status}`);
  const apiCashPage = await api(`${BASE}/api/cash`);
  check('GET /api/cash (no registers) returns []', apiCashPage.status === 200 && Array.isArray(apiCashPage.json));

  const settings = await api(`${BASE}/api/settings`, { headers: { Cookie: owner.cookie } });
  const branch = (settings.json?.branches || [])[0];
  check('owner org has a branch', !!branch?.id, branch?.name || 'n/a');

  console.log('== 3) Cash register ==');
  let registers = (await api(`${BASE}/api/cash/registers?branch_id=${branch.id}`, { headers: { Cookie: owner.cookie } })).json;
  registers = Array.isArray(registers) ? registers : registers.data || [];
  let registerId;
  if (!registers.length) {
    const createReg = await api(`${BASE}/api/cash/registers`, {
      method: 'POST',
      headers: { Cookie: owner.cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch_id: branch.id, name: 'Main Counter', code: `E2E${uniq.slice(-4)}` }),
    });
    check('create register', createReg.status === 201 || createReg.status === 200, `status=${createReg.status}`);
    registerId = createReg.json?.id;
  } else {
    registerId = registers[0].id;
  }
  check('register ready', !!registerId, registerId?.slice(0, 8) || 'n/a');

  console.log('== 4) Open cash session (the POS gate) ==');
  const before = await api(`${BASE}/api/cash/sessions?current=true&branch_id=${branch.id}`, { headers: { Cookie: owner.cookie } });
  check('no current session before opening', before.status === 200 && (before.json == null || before.json === undefined || before.json.count === 0), `status=${before.status}`);

  const opened = await api(`${BASE}/api/cash/sessions`, {
    method: 'POST',
    headers: { Cookie: owner.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'open', register_id: registerId, branch_id: branch.id, opening_float: 100000, notes: 'E2E shift' }),
  });
  check('open session succeeds', (opened.status === 200 || opened.status === 201) && opened.json?.id, `status=${opened.status}`);
  const sessionId = opened.json?.id;
  check('session status OPEN', opened.json?.status === 'OPEN', opened.json?.status || 'n/a');

  const cur = await api(`${BASE}/api/cash/sessions?current=true&branch_id=${branch.id}`, { headers: { Cookie: owner.cookie } });
  check('current=true returns the open session', !!cur.json?.id && cur.json.id === sessionId, cur.json?.id === sessionId ? 'match' : 'mismatch');

  const summary = await api(`${BASE}/api/cash/sessions?summary=${sessionId}`, { headers: { Cookie: owner.cookie } });
  check('summary returns session + expected', !!summary.json?.session && typeof summary.json?.expected === 'number', `expected=${summary.json?.expected}`);

  console.log('== 5) Movement + close (zero variance) ==');
  const move = await api(`${BASE}/api/cash/sessions`, {
    method: 'POST',
    headers: { Cookie: owner.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'movement', session_id: sessionId, type: 'CASH_IN', amount: 50000, direction: 'IN', reason: 'Top-up' }),
  });
  check('record CASH_IN movement', (move.status === 200 || move.status === 201) && move.json?.ok !== false, `status=${move.status}`);
  const sum2 = await api(`${BASE}/api/cash/sessions?summary=${sessionId}`, { headers: { Cookie: owner.cookie } });
  check('summary reflects CASH_IN', sum2.json?.cashIn === 50000, `cashIn=${sum2.json?.cashIn}`);

  // expected = opening 100000 + CASH_IN 50000 = 150000
  const closed = await api(`${BASE}/api/cash/sessions`, {
    method: 'POST',
    headers: { Cookie: owner.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'close', session_id: sessionId, closing_cash: 150000, notes: 'E2E end' }),
  });
  check('close session succeeds', (closed.status === 200 || closed.status === 201) && closed.json?.needsApproval !== undefined, `status=${closed.status} variance=${closed.json?.cash_variance}`);
  check('zero variance -> no approval needed', closed.json?.needsApproval === false && closed.json?.cash_variance === 0, `variance=${closed.json?.cash_variance}`);

  const list = await api(`${BASE}/api/cash/sessions?branch_id=${branch.id}&page=1&perPage=10`, { headers: { Cookie: owner.cookie } });
  const mine = (list.json?.data || []).find((s) => s.id === sessionId);
  check('history shows CLOSED session', !!mine && mine.status === 'CLOSED', mine?.status || 'n/a');

  console.log('== 6) Variance session -> manager approval ==');
  const s2 = await api(`${BASE}/api/cash/sessions`, {
    method: 'POST',
    headers: { Cookie: owner.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'open', register_id: registerId, branch_id: branch.id, opening_float: 100000, notes: 'E2E variance' }),
  });
  const s2Id = s2.json?.id;
  check('second session opens', !!s2Id, s2.json?.status || 'n/a');
  const short = await api(`${BASE}/api/cash/sessions`, {
    method: 'POST',
    headers: { Cookie: owner.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'close', session_id: s2Id, closing_cash: 80000, notes: 'short' }),
  });
  check('variance triggers APPROVAL_REQUIRED', short.json?.needsApproval === true && short.json?.cash_variance === -20000, `variance=${short.json?.cash_variance}`);
  const apprSess = await api(`${BASE}/api/cash/sessions`, {
    method: 'POST',
    headers: { Cookie: owner.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'approve', session_id: s2Id }),
  });
  check('approve succeeds', apprSess.status === 200 && apprSess.json?.ok !== false, `status=${apprSess.status}`);
  const list2 = await api(`${BASE}/api/cash/sessions?branch_id=${branch.id}&page=1&perPage=10`, { headers: { Cookie: owner.cookie } });
  const s2row = (list2.json?.data || []).find((s) => s.id === s2Id);
  check('history shows APPROVED session', !!s2row && s2row.status === 'APPROVED', s2row?.status || 'n/a');

  const after = await api(`${BASE}/api/cash/sessions?current=true&branch_id=${branch.id}`, { headers: { Cookie: owner.cookie } });
  check('no current session after close', after.status === 200 && (after.json == null || after.json === undefined));

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error('E2E crashed:', e);
  process.exit(1);
});