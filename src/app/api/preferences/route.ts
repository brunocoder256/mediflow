import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { sanitizeError } from '@/lib/security';
import { normalizePreferences } from '@/lib/preferences';
import { isSupportedLanguage } from '@/lib/i18n/config';
import { isDateFormatId, isNumberFormatId } from '@/lib/format';

async function getSelf(sb: any) {
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;
  return user;
}

/** Current user's personal interface preferences. */
export async function GET() {
  try {
    const sb: any = await createServerSupabaseClient();
    const user = await getSelf(sb);
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const { data: profile } = await sb
      .from('profiles')
      .select('language, timezone, date_format, number_format')
      .eq('auth_user_id', user.id)
      .single();
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    return NextResponse.json({ preferences: normalizePreferences(profile) });
  } catch (e: any) {
    return NextResponse.json({ error: sanitizeError(e?.message ?? '') }, { status: 500 });
  }
}

/**
 * Update the current user's OWN personal preferences only.
 * Organization-wide business settings (country, currency, locale) are never
 * touched here — those live behind /api/settings and RBAC.
 */
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const sb: any = await createServerSupabaseClient();
    const user = await getSelf(sb);
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const patch: Record<string, string | null> = {};

    if ('language' in body) {
      if (body.language === null || body.language === '') {
        patch.language = null;
      } else if (!isSupportedLanguage(body.language)) {
        return NextResponse.json(
          { error: `Unsupported language: ${String(body.language)}` },
          { status: 400 },
        );
      } else {
        patch.language = body.language;
      }
    }

    if ('timezone' in body) {
      if (body.timezone === null || body.timezone === '') patch.timezone = null;
      else if (typeof body.timezone !== 'string' || body.timezone.length > 64) {
        return NextResponse.json({ error: 'Invalid time zone' }, { status: 400 });
      } else {
        patch.timezone = body.timezone;
      }
    }

    if ('date_format' in body) {
      if (body.date_format === null || body.date_format === '') patch.date_format = null;
      else if (!isDateFormatId(body.date_format)) {
        return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
      } else {
        patch.date_format = body.date_format;
      }
    }

    if ('number_format' in body) {
      if (body.number_format === null || body.number_format === '') patch.number_format = null;
      else if (!isNumberFormatId(body.number_format)) {
        return NextResponse.json({ error: 'Invalid number format' }, { status: 400 });
      } else {
        patch.number_format = body.number_format;
      }
    }

    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: 'No valid preference keys supplied' }, { status: 400 });
    }

    const { error } = await sb
      .from('profiles')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('auth_user_id', user.id);
    if (error) return NextResponse.json({ error: sanitizeError(error.message) }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: sanitizeError(e?.message ?? '') }, { status: 500 });
  }
}
