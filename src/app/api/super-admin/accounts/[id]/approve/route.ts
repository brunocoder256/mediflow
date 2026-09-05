import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isSuperAdmin, superAdminProfileId, platformAudit } from '@/lib/super-admin';

function tempPassword(): string {
  return 'MF@' + randomBytes(5).toString('hex');
}

/** Create the owner auth user: invite by email, or (no SMTP) create with a one-time provisional password. */
async function createOwnerAuthUser(admin: any, email: string, fullName: string) {
  const inviteEmail = `${process.env.NEXT_PUBLIC_APP_URL || ''}/auth/reset-password`;
  const { data: inviteData, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    ...(inviteEmail ? { redirectTo: inviteEmail } : {}),
  });
  if (!inviteErr && inviteData?.user) {
    return { userId: inviteData.user.id, email, provisionalPassword: null as string | null };
  }

  const provisional = tempPassword();
  const { data, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: provisional,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (createErr || !data.user) {
    throw new Error(`Unable to create login for ${email}: ${createErr?.message || 'unknown error'}`);
  }
  return { userId: data.user.id, email, provisionalPassword: provisional };
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const sb: any = await createServerSupabaseClient();
    if (!(await isSuperAdmin(sb))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const actorId = await superAdminProfileId(sb);

    const admin = createAdminSupabaseClient();
    const { data: reg, error: regErr } = await admin.from('registrations').select('*').eq('id', id).single();
    if (regErr || !reg) return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    if (reg.status !== 'pending') {
      return NextResponse.json({ error: 'This application is no longer pending approval.' }, { status: 409 });
    }

    // Concurrency guard: only a pending registration may be approved (single transition).
    const { data: claimed, error: guardErr } = await admin
      .from('registrations')
      .update({ status: 'active', approved_by: actorId, approved_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'pending')
      .select()
      .single();
    if (guardErr || !claimed) {
      return NextResponse.json({ error: 'This application was already processed.' }, { status: 409 });
    }

    const now = new Date().toISOString();
    const fail = (msg: string) => {
      // Rollback the claim so the application can be retried after a partial failure.
      admin.from('registrations').update({ status: 'pending', approved_by: null, approved_at: null }).eq('id', id).then();
      throw new Error(msg);
    };

    // Trial defaults from platform settings (new accounts get a free trial).
    let trialDays = 3;
    try {
      const { data: ps } = await admin.from('platform_settings').select('trial_days').eq('id', 1).maybeSingle();
      if (ps?.trial_days) trialDays = ps.trial_days;
    } catch {
      /* keep default */
    }
    const trialEndsAt = new Date(Date.now() + trialDays * 86_400_000).toISOString();

    // 1) Organization (the client account)
    const { data: org, error: orgErr } = await admin
      .from('organizations')
      .insert({
        name: reg.business_name,
        business_type: reg.business_type || 'pharmacy',
        registration_number: reg.reference,
        phone: reg.owner_phone,
        email: reg.owner_email,
        address: reg.location,
        status: 'active',
        plan: 'trial',
        trial_ends_at: trialEndsAt,
      })
      .select()
      .single();
    if (orgErr || !org) fail(`Failed to create organization: ${orgErr?.message}`);

    // Link the registration to its new organization so later suspend/activate can reach it.
    await admin.from('registrations').update({ organization_id: org.id }).eq('id', id);

    // 2) Main branch
    const { data: branch, error: branchErr } = await admin
      .from('branches')
      .insert({
        organization_id: org.id,
        name: 'Main Branch',
        code: 'MB01',
        phone: reg.owner_phone,
        address: reg.location,
        is_active: true,
      })
      .select()
      .single();
    if (branchErr || !branch) fail(`Failed to create branch: ${branchErr?.message}`);

    // 3) Owner login (auth user)
    const login = await createOwnerAuthUser(admin, reg.owner_email, reg.owner_full_name);

    // 4) Owner profile
    const { data: profile, error: profileErr } = await admin
      .from('profiles')
      .insert({
        auth_user_id: login.userId,
        organization_id: org.id,
        full_name: reg.owner_full_name,
        email: reg.owner_email,
        phone: reg.owner_phone,
        username: reg.owner_email.split('@')[0],
        status: 'active',
        is_active: true,
        default_branch_id: branch.id,
        failed_login_attempts: 0,
      })
      .select()
      .single();
    if (profileErr || !profile) fail(`Failed to create owner profile: ${profileErr?.message}`);

    // 5) Owner role with all permissions
    const { data: role, error: roleErr } = await admin
      .from('roles')
      .insert({ organization_id: org.id, name: 'Owner', description: 'Full system access', is_system_role: true })
      .select()
      .single();
    if (roleErr || !role) fail(`Failed to create owner role: ${roleErr?.message}`);
    const { data: perms } = await admin.from('permissions').select('id');
    if (perms?.length) {
      const { error: rpErr } = await admin
        .from('role_permissions')
        .insert(perms.map((p: any) => ({ role_id: role.id, permission_id: p.id })));
      if (rpErr) fail(`Failed to assign permissions: ${rpErr.message}`);
    }

    // 6) Role + branch assignment
    await admin.from('user_roles').insert({ user_id: profile.id, role_id: role.id, branch_id: branch.id });
    await admin.from('user_branches').insert({ user_id: profile.id, branch_id: branch.id, is_default: true });

    // 7) Default org settings
    await admin
      .from('organization_settings')
      .insert({
        organization_id: org.id,
        receipt_header: `${reg.business_name}\nThank you for your purchase!`,
        receipt_footer: `For inquiries: ${reg.owner_phone}`,
        default_tax_rate: 18,
        default_currency: 'UGX',
        low_stock_threshold: 10,
        expiry_warning_days: 90,
      });

    // 8) Audit (platform scope)
    if (actorId) {
      await platformAudit(actorId, {
        action: 'ACCOUNT_APPROVED',
        entityType: 'registrations',
        entityId: reg.id,
        oldValues: { status: 'pending' },
        newValues: { status: 'active', organization_id: org.id, approved_at: now, business_name: reg.business_name },
      });
    }

    return NextResponse.json({
      ok: true,
      account: { reference: reg.reference, organization_id: org.id, status: 'active', plan: 'trial', trial_ends_at: trialEndsAt },
      login,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Approval failed' }, { status: 500 });
  }
}