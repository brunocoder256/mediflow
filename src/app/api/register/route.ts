import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { registrationSchema } from '@/lib/validations/auth';

/** Platform-scope organization used for audit log entries (matches register_account RPC). */
const PLATFORM_ORG = 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a00';

/**
 * Public: instantly create a MediFlow account with a 3-day free trial.
 * Creates the auth user (with the owner's own password), organization, branch,
 * owner role + profile, and a registration row so the Super Admin can see the
 * account is on trial and approve/suspend it later. The client signs the new
 * owner in immediately after this returns.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = registrationSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues?.[0];
      return NextResponse.json({ error: issue?.message ?? 'Invalid submission' }, { status: 400 });
    }
    const d = parsed.data;
    const email = d.owner_email.trim().toLowerCase();
    const admin = createAdminSupabaseClient();
    const now = new Date().toISOString();

    // Duplicate application check (an active registration with this email already exists).
    const { data: dup } = await admin
      .from('registrations')
      .select('id')
      .ilike('owner_email', email)
      .neq('status', 'rejected')
      .maybeSingle();
    if (dup) {
      return NextResponse.json(
        { error: 'This email already has an account. Please sign in instead.' },
        { status: 409 },
      );
    }

    // 1) Owner login — created with the password the owner chose (no provisional password).
    const { data: createdUser, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: d.password,
      email_confirm: true,
      user_metadata: { full_name: d.owner_full_name },
    });
    if (createErr || !createdUser?.user?.id) {
      const msg = String(createErr?.message ?? '');
      if (/already registered|already been registered|previous sign up/i.test(msg)) {
        return NextResponse.json({ error: 'This email is already registered. Please sign in.' }, { status: 409 });
      }
      return NextResponse.json({ error: msg || 'Unable to create your login' }, { status: 400 });
    }
    const ownerUserId = createdUser.user.id;

    const fail = (msg: string) => {
      throw new Error(msg);
    };

    // Trial defaults from platform settings (3-day free trial for new accounts).
    let trialDays = 3;
    try {
      const { data: ps } = await admin.from('platform_settings').select('trial_days').eq('id', 1).maybeSingle();
      if (ps?.trial_days) trialDays = ps.trial_days;
    } catch {
      /* keep default */
    }
    const trialEndsAt = new Date(Date.now() + trialDays * 86_400_000).toISOString();

    // Sequential, human-friendly reference (keeps the MF-00001 format).
    const { count } = await admin.from('registrations').select('id', { count: 'exact', head: true });
    const reference = `MF-${String((count ?? 0) + 1).padStart(5, '0')}`;

    // 2) Organization — active with the trial plan.
    const { data: org, error: orgErr } = await admin
      .from('organizations')
      .insert({
        name: d.business_name,
        business_type: d.business_type || 'pharmacy',
        registration_number: reference,
        phone: d.owner_phone,
        email,
        address: d.location || null,
        status: 'active',
        plan: 'trial',
        trial_ends_at: trialEndsAt,
      })
      .select()
      .single();
    if (orgErr || !org) fail(`Failed to create organization: ${orgErr?.message}`);

    // 3) Main branch
    const { data: branch, error: branchErr } = await admin
      .from('branches')
      .insert({
        organization_id: org.id,
        name: 'Main Branch',
        code: 'MB01',
        phone: d.owner_phone,
        address: d.location || null,
        is_active: true,
      })
      .select()
      .single();
    if (branchErr || !branch) fail(`Failed to create branch: ${branchErr?.message}`);

    // 4) Registration row (status active → the Super Admin sees a live trial account).
    const { data: registration, error: regErr } = await admin
      .from('registrations')
      .insert({
        reference,
        business_name: d.business_name,
        business_type: d.business_type || null,
        owner_full_name: d.owner_full_name,
        owner_email: email,
        owner_phone: d.owner_phone,
        location: d.location || null,
        status: 'active',
        organization_id: org.id,
        approved_at: now,
      })
      .select()
      .single();
    if (regErr || !registration) fail(`Failed to record registration: ${regErr?.message}`);

    // 5) Owner profile
    const { data: profile, error: profileErr } = await admin
      .from('profiles')
      .insert({
        auth_user_id: ownerUserId,
        organization_id: org.id,
        full_name: d.owner_full_name,
        email,
        phone: d.owner_phone,
        username: email.split('@')[0],
        status: 'active',
        is_active: true,
        default_branch_id: branch.id,
        failed_login_attempts: 0,
      })
      .select()
      .single();
    if (profileErr || !profile) fail(`Failed to create owner profile: ${profileErr?.message}`);

    // 6) Owner role with all permissions
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

    // 7) Role + branch assignment
    await admin.from('user_roles').insert({ user_id: profile.id, role_id: role.id, branch_id: branch.id });
    await admin.from('user_branches').insert({ user_id: profile.id, branch_id: branch.id, is_default: true });

    // 8) Default org settings
    await admin.from('organization_settings').insert({
      organization_id: org.id,
      receipt_header: `${d.business_name}\nThank you for your purchase!`,
      receipt_footer: `For inquiries: ${d.owner_phone}`,
      default_tax_rate: 18,
      default_currency: 'UGX',
      low_stock_threshold: 10,
      expiry_warning_days: 90,
    });

    // 9) Audit trail (platform scope)
    await admin.from('audit_logs').insert({
      organization_id: PLATFORM_ORG,
      user_id: null,
      created_by: null,
      action: 'ACCOUNT_REGISTERED',
      entity_type: 'registrations',
      entity_id: registration.id,
      old_values: null,
      new_values: {
        reference,
        business_name: d.business_name,
        owner_email: email,
        organization_id: org.id,
        plan: 'trial',
        trial_ends_at: trialEndsAt,
      },
      branch_id: null,
    });

    return NextResponse.json(
      {
        ok: true,
        registration: {
          reference,
          organization_id: org.id,
          status: 'active',
          plan: 'trial',
          trial_ends_at: trialEndsAt,
          trial_days: trialDays,
          email,
        },
      },
      { status: 201 },
    );
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unable to create your account' }, { status: 400 });
  }
}