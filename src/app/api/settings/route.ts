import { NextResponse } from 'next/server';
import { sanitizeError } from '@/lib/security';
import { getSB } from '@/lib/services/supabase';
import { hasPermission } from '@/lib/auth';
import { normalizeCountryCode } from '@/lib/regions';
import { isCheckoutWorkflow, planAllowsSeparateCheckout, DEFAULT_CHECKOUT_WORKFLOW } from '@/lib/checkout-workflow';

async function getActor(sb: any) {
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;
  const { data: profile } = await sb.from('profiles').select('id, organization_id').eq('auth_user_id', user.id).single();
  if (!profile) return null;
  return { user, profile };
}

export async function GET() {
  try {
    const sb: any = await getSB();
    const { user } = (await sb.auth.getUser()).data;
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    const { data: prof } = await sb.from('profiles').select('organization_id').eq('auth_user_id', user.id).single();
    if (!prof) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
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
    return NextResponse.json({ error: sanitizeError(e?.message ?? '') }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const sb: any = await getSB();
    const actor = await getActor(sb);
    if (!actor) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const canEdit =
      (await hasPermission(sb, actor.profile.id, actor.profile.organization_id, 'settings.edit')) ||
      (await hasPermission(sb, actor.profile.id, actor.profile.organization_id, 'settings.manage'));
    if (!canEdit) {
      return NextResponse.json({ error: 'Forbidden: settings.edit required' }, { status: 403 });
    }

    const orgId = actor.profile.organization_id;

    if (body.organization) {
      const allowed = ['name', 'registration_number', 'phone', 'email', 'address', 'currency', 'timezone', 'country', 'locale'];
      const upd: any = {};
      for (const k of allowed) if (body.organization[k] !== undefined) upd[k] = body.organization[k];
      // Store only a validated ISO 3166-1 alpha-2 code (or null to clear).
      if ('country' in upd) upd.country = normalizeCountryCode(upd.country);

      // The operating currency is financially sensitive: changing it is
      // restricted to organization administrators. Unchanged values are
      // silently dropped so non-admins can still edit other organization fields.
      if (upd.currency !== undefined) {
        const normalized = String(upd.currency ?? '').trim().toUpperCase();
        const { data: currentOrg } = await sb
          .from('organizations')
          .select('currency')
          .eq('id', orgId)
          .single();
        const current = String(currentOrg?.currency ?? '').trim().toUpperCase();
        if (normalized !== current) {
          const isAdmin =
            (await hasPermission(sb, actor.profile.id, orgId, 'settings.manage')) ||
            (await hasPermission(sb, actor.profile.id, orgId, 'users.manage'));
          if (!isAdmin) {
            return NextResponse.json(
              { error: 'Only an organization administrator can change the operating currency' },
              { status: 403 },
            );
          }
          upd.currency = normalized || null;
        } else {
          delete upd.currency;
        }
      }

      if (Object.keys(upd).length) {
        upd.updated_at = new Date().toISOString();
        await sb.from('organizations').update(upd).eq('id', orgId);
      }
    }
    if (body.organization_settings) {
      const s = body.organization_settings;
      const forCheckout: any = {};
      if (s.checkout_workflow !== undefined) {
        // Only administrators may change the checkout workflow, and only the
        // Pharmacy (pro) / Enterprise plans may enable a multi-person checkout.
        // This prevents bypassing the setting through a direct API request.
        if (!isCheckoutWorkflow(s.checkout_workflow)) {
          return NextResponse.json({ error: 'Invalid checkout workflow' }, { status: 400 });
        }
        const isAdmin =
          (await hasPermission(sb, actor.profile.id, orgId, 'settings.manage')) ||
          (await hasPermission(sb, actor.profile.id, orgId, 'users.manage'));
        if (!isAdmin) {
          return NextResponse.json({ error: 'Only an organization administrator can change the checkout workflow' }, { status: 403 });
        }
        if (s.checkout_workflow !== DEFAULT_CHECKOUT_WORKFLOW) {
          const { data: orgRow } = await sb.from('organizations').select('plan_tier').eq('id', orgId).single();
          if (!planAllowsSeparateCheckout(orgRow?.plan_tier)) {
            return NextResponse.json(
              { error: 'Separate salesperson/cashier checkout is available on the Pharmacy and Enterprise plans only' },
              { status: 403 },
            );
          }
        }
        forCheckout.checkout_workflow = s.checkout_workflow;
      }
      const payload: any = {
        organization_id: orgId,
        receipt_header: s.receipt_header,
        receipt_footer: s.receipt_footer,
        default_tax_rate: s.default_tax_rate,
        default_currency: s.default_currency,
        low_stock_threshold: s.low_stock_threshold,
        expiry_warning_days: s.expiry_warning_days,
        ...forCheckout,
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
    return NextResponse.json({ error: sanitizeError(e?.message ?? '') }, { status: 500 });
  }
}
