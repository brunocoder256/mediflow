import { NextResponse } from "next/server";
import { sanitizeError } from '@/lib/security';
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const dynamic = "force-dynamic";

/**
 * Server-side logout.
 *
 * The Supabase auth session lives in httpOnly `sb-*` cookies that JavaScript
 * (document.cookie) cannot remove. A purely client-side `signOut()` therefore
 * leaves the session cookie behind — the user looks logged out but the next
 * navigation back to the dashboard re-authenticates them. This route performs
 * the sign-out where the cookies can actually be cleared.
 *
 * A successful response clears the auth cookies; the client then hard-navigates
 * to /auth/login.
 */
export async function POST() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Cookie mutations are unavailable in some read contexts; the
            // manual sweep below is the fallback that still clears the session.
          }
        },
      },
    },
  );

  // Revoke + clear the session server-side. Keep going even if the auth server
  // is unreachable — the cookie sweep below must still run so logout works
  // offline / during auth-provider hiccups.
  try {
    await supabase.auth.signOut();
  } catch {
    /* non-blocking */
  }

  // Belt & braces: expire every remaining Supabase session cookie. This is the
  // authoritative cleanup and also covers httpOnly cookies the browser client
  // could never touch.
  for (const c of cookieStore.getAll()) {
    if (c.name.startsWith("sb-")) {
      cookieStore.set(c.name, "", {
        path: "/",
        maxAge: 0,
        httpOnly: true,
        sameSite: "lax",
      });
    }
  }

  return NextResponse.json({ ok: true });
}