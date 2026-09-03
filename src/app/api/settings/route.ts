import { NextResponse } from 'next/server';
import { getSB } from '@/lib/services/supabase';

export async function GET() {
  try {
    const sb: any = await getSB();
    const { data: { user } } = await sb.auth.getUser();
    const { data: prof } = await sb.from('profiles').select('organization_id').eq('auth_user_id', user.id).single();
    const orgId = prof.organization_id;
    const { data: org } = await sb.from('organizations').select('*').eq('id', orgId).single();
    const { data: orgSettings } = await sb.from('organization_settings').select('*').eq('organization_id', orgId).maybeSingle();
    const { data: branches } = await sb.from('branches').select('*').eq('organization_id', orgId).order('name');
    const branchIds = (branches ?? []).map((b: any) => b.id);
    let branchSettings: any[] = [];
    if (branchIds.length) {
      const { data } = await sb.from('branch_settings').select('*').in('branch_id', branchIds);
      branchSettings = data ?? [];
    }
    return NextResponse.json({ organization: org, organization_settings: orgSettings, branches, branch_settings: branchSettings });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const sb: any = await getSB();
    const { data: { user } } = await sb.auth.getUser();
    const { data: prof } = await sb.from('profiles').select('organization_id').eq('auth_user_id', user.id).single();
    const orgId = prof.organization_id;

    if (body.organization) {
      const allowed = ['name', 'registration_number', 'phone', 'email', 'address', 'currency', 'timezone'];
      const upd: any = {};
      for (const k of allowed) if (body.organization[k] !== undefined) upd[k] = body.organization[k];
      if (Object.keys(upd).length) {
        upd.updated_at = new Date().toISOString();
        await sb.from('organizations').update(upd).eq('id', orgId);
      }
    }
    if (body.organization_settings) {
      const s = body.organization_settings;
      const payload: any = {
        organization_id: orgId,
        receipt_header: s.receipt_header,
        receipt_footer: s.receipt_footer,
        default_tax_rate: s.default_tax_rate,
        default_currency: s.default_currency,
        low_stock_threshold: s.low_stock_threshold,
        expiry_warning_days: s.expiry_warning_days,
        updated_at: new Date().toISOString(),
      };
      // upsert
      const { data: existing } = await sb.from('organization_settings').select('id').eq('organization_id', orgId).maybeSingle();
      if (existing) await sb.from('organization_settings').update(payload).eq('organization_id', orgId);
      else await sb.from('organization_settings').insert({ ...payload, created_at: new Date().toISOString() });
    }
    if (body.branch_settings) {
      for (const bs of body.branch_settings) {
        const { branch_id, receipt_prefix, invoice_prefix, default_payment_method } = bs;
        const payload: any = { branch_id, receipt_prefix, invoice_prefix, default_payment_method, updated_at: new Date().toISOString() };
        const { data: ex } = await sb.from('branch_settings').select('id').eq('branch_id', branch_id).maybeSingle();
        if (ex) await sb.from('branch_settings').update(payload).eq('branch_id', branch_id);
        else await sb.from('branch_settings').insert({ ...payload, created_at: new Date().toISOString() });
      }
    }
    if (body.branches) {
      for (const b of body.branches) {
        await sb.from('branches').update({ name: b.name, code: b.code, phone: b.phone, address: b.address, is_active: b.is_active, updated_at: new Date().toISOString() }).eq('id', b.id).eq('organization_id', orgId);
      }
    }
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
