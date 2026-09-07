const { createClient } = require('@supabase/supabase-js');
const url = process.env.SUPA_URL;
const key = process.env.SUPA_KEY;
const sb = createClient(url, key);

async function main() {
  const now = Date.now();

  // Create a throwaway org in 'active' + 'trial' to simulate a real approved trial.
  const { data: org, error: orgErr } = await sb.from('organizations').insert({
    name: 'BILLING_TEST_' + now,
    plan: 'trial',
    status: 'active',
    trial_ends_at: new Date(now + 3 * 86400000).toISOString(),
  }).select().single();
  if (orgErr) { console.log('insert org ERR', orgErr.message); return; }
  const oid = org.id;
  console.log('Created test org', oid, 'plan', org.plan);

  // Test 1: gate on active trial -> not blocked
  const rpcNeedsAuth = await sb.rpc('get_my_access_status');
  console.log('RPC via service role (no auth uid):', rpcNeedsAuth.error ? ('ERR ' + rpcNeedsAuth.error.message) : JSON.stringify(rpcNeedsAuth.data));

  // Test 2: credit_paid_cycles for 3 months
  const { data: credit, error: creditErr } = await sb.rpc('credit_paid_cycles', {
    p_organization_id: oid,
    p_months: 3,
  });
  if (creditErr) { console.log('credit ERR', creditErr.message); return; }
  console.log('credit result:', JSON.stringify(credit));
  const { data: after } = await sb.from('organizations').select('plan,status,paid_cycles,access_ends_at,trial_ends_at').eq('id', oid).single();
  console.log('after credit org:', JSON.stringify(after));
  const endMs = after.access_ends_at ? new Date(after.access_ends_at).getTime() : 0;
  console.log('access_ends ~3 months ahead?', (endMs - Date.now()) / 86400000, 'days');

  // Test 3: credit again (stacking) for 1 more month -> paid_cycles 4, access extends
  const { data: credit2 } = await sb.rpc('credit_paid_cycles', { p_organization_id: oid, p_months: 1 });
  const { data: after2 } = await sb.from('organizations').select('paid_cycles,access_ends_at').eq('id', oid).single();
  console.log('after second credit:', JSON.stringify(after2), 'credit2:', JSON.stringify(credit2));

  // Test 4: coupon-like protection — set access_ends_at in the past, simulate an "expired paid" account
  await sb.from('organizations').update({ access_ends_at: new Date(Date.now() - 3600 * 1000).toISOString() }).eq('id', oid);
  // A fresh credit should extend from now (+months), not from the past expiry (correct: GREATEST(now, expiry))
  const { data: c3, error: e3 } = await sb.rpc('credit_paid_cycles', { p_organization_id: oid, p_months: 2 });
  if (e3) console.log('c3 ERR', e3.message);
  else console.log('credit after past expiry (should be +2 months from now):', JSON.stringify(c3));
  const { data: after3 } = await sb.from('organizations').select('paid_cycles,access_ends_at').eq('id', oid).single();
  console.log('after3 org:', JSON.stringify(after3),
    '| end-approximately:', after3.access_ends_at ? ((new Date(after3.access_ends_at).getTime() - Date.now()) / 86400000).toFixed(1) : 'null', 'days');

  // Cleanup
  await sb.from('organizations').delete().eq('id', oid);
  console.log('cleaned up test org', oid);
}
main().catch(e => console.log('FATAL', e.message));
