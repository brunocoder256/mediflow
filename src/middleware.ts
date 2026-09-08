import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { rateLimit, setRateLimitHeaders } from "@/lib/rate-limit";

const publicRoutes = ["/", "/auth/*", "/features", "/pricing", "/about", "/contact", "/demo", "/terms", "/privacy", "/_next/*", "/manifest.json", "/sw.js", "/offline.html", "/icon-*.png", "/mediflow-logo.png", "/Mediflow IQ logo.png"];

function isPublicRoute(pathname: string): boolean {
  return publicRoutes.some((route) => {
    if (route.endsWith("/*")) {
      return pathname.startsWith(route.slice(0, -2));
    }
    return pathname === route;
  });
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );
  return response;
}

function applyCorsHeaders(response: NextResponse, origin: string | null): NextResponse {
  const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:3000,http://localhost:3333,https://mediflow.vercel.app,https://www.mediflowiq.online,https://mediflowiq.online")
    .split(",")
    .map((o) => o.trim());
  const allowedOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-Id");
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Access-Control-Max-Age", "86400");
  return response;
}

function getRateLimitConfig(pathname: string, ip: string, method: string) {
  if (pathname.startsWith("/api/auth") || pathname === "/api/register") {
    return { key: `auth:${ip}`, limit: 10, windowMs: 60_000 };
  }
  if (pathname.startsWith("/api/super-admin")) {
    return { key: `admin:${ip}`, limit: 30, windowMs: 60_000 };
  }
  if (pathname.startsWith("/api/sales") || pathname.startsWith("/api/pos")) {
    return { key: `write:${ip}`, limit: 60, windowMs: 60_000 };
  }
  if (pathname.startsWith("/api/") && method === "GET") {
    return { key: `read:${ip}`, limit: 200, windowMs: 60_000 };
  }
  if (pathname.startsWith("/api/")) {
    return { key: `api:${ip}`, limit: 120, windowMs: 60_000 };
  }
  return { key: `page:${ip}`, limit: 300, windowMs: 60_000 };
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Compute rate limit result ONCE per request (reused for both the 429 gate and response headers).
  const isApi = pathname.startsWith("/api/");
  const rateLimitConfig = isApi
    ? getRateLimitConfig(pathname, getClientIp(request), request.method)
    : null;
  const rateResult = rateLimitConfig
    ? rateLimit({ ...rateLimitConfig, clientKey: rateLimitConfig.key })
    : null;

  // Handle CORS preflight for API routes.
  if (isApi && request.method === "OPTIONS") {
    const preflight = new NextResponse(null, { status: 204 });
    applyCorsHeaders(preflight, request.headers.get("origin"));
    applySecurityHeaders(preflight);
    if (rateLimitConfig && rateResult) {
      setRateLimitHeaders(preflight.headers, rateResult, rateLimitConfig.limit);
    }
    return preflight;
  }

  // --- Rate limiting for API routes ---
  if (rateLimitConfig && rateResult && !rateResult.allowed) {
    const retryAfter = Math.ceil((rateResult.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
        },
      }
    );
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as never)
          );
        },
      },
    }
  );

  // IMPORTANT: Do NOT run logic between createServerClient and getUser
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Don't redirect API or asset requests — let them return JSON 401/404 instead of HTML redirect (fixes manifest Syntax error & api 404 loops)
  if (isApi || pathname === "/manifest.json" || pathname === "/sw.js" || pathname === "/offline.html" || pathname.match(/\.(?:json|png|jpg|jpeg|svg|ico|webp)$/)) {
    applySecurityHeaders(supabaseResponse);
    applyCorsHeaders(supabaseResponse, request.headers.get("origin"));

    // Set rate limit headers for API responses (reuse the single computed result).
    if (rateLimitConfig && rateResult) {
      setRateLimitHeaders(supabaseResponse.headers, rateResult, rateLimitConfig.limit);
    }

    return supabaseResponse;
  }

  if (!isPublicRoute(pathname) && !user) {
    // Offline passcode access: a passcode-authorized device is allowed into the
    // app shell even without a live server session, so users can keep working
    // from the offline Dexie cache for full days without a connection. The real
    // data APIs still require a live session and will 401 when offline-without-one
    // (offline reads come from local cache). When back online, the app silently
    // re-authenticates and the real session cookie replaces this signal.
    const offlineAuthorized =
      request.cookies.get("mediflow_offline_session")?.value === "1";
    if (offlineAuthorized) {
      applySecurityHeaders(supabaseResponse);
      applyCorsHeaders(supabaseResponse, request.headers.get("origin"));
      return supabaseResponse;
    }
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  applySecurityHeaders(supabaseResponse);

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
