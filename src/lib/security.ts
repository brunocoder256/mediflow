/**
 * Shared security helpers for MediFlow API routes.
 */

/** Allowed origins for CORS. In production, set CORS_ORIGINS as a comma-separated list. */
const DEFAULT_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3333",
  "https://mediflow.vercel.app",
];

function getAllowedOrigins(): string[] {
  const envOrigins = process.env.CORS_ORIGINS;
  if (envOrigins) return envOrigins.split(",").map((o) => o.trim());
  return DEFAULT_ORIGINS;
}

/**
 * Applies CORS headers to a Response (or NextResponse).
 * Call from every API route handler that needs browser access.
 */
export function applyCorsHeaders(response: Response, origin: string | null): Response {
  const allowed = getAllowedOrigins();
  const ALLOW = allowed.includes(origin ?? "") ? origin! : allowed[0];

  response.headers.set("Access-Control-Allow-Origin", ALLOW);
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-Id");
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Access-Control-Max-Age", "86400");

  return response;
}

/**
 * Returns a preflight 204 Response with CORS headers.
 */
export function corsPreflightResponse(origin: string | null): Response {
  const res = new Response(null, { status: 204 });
  return applyCorsHeaders(res, origin);
}

/**
 * Returns a sanitized error message for client responses.
 * Hides internal DB/Supabase error details, keeps known user-facing messages.
 */
export function sanitizeError(raw: string): string {
  const safePatterns = [
    "Unauthenticated",
    "Profile not found",
    "No organization",
    "Account deactivated",
    "Organization account deactivated",
    "Forbidden",
    "Unauthorized",
    "Not found",
    "Validation error",
    // Zod messages:
    "must be",
    "required",
    "Too many requests",
  ];

  for (const p of safePatterns) {
    if (raw.includes(p)) return p;
  }

  return "Internal server error";
}

/**
 * Builds a JSON error response with a sanitized, client-safe message.
 * Raw error details are only logged server-side, never returned to the client.
 */
export function jsonSafeError(error: unknown, raw: string, status = 500) {
  console.error(`[api] ${raw}`);
  return Response.json({ error: sanitizeError(raw) }, { status });
}

/** Rate-limit tier presets. */
export const RATE_LIMITS = {
  /** Public endpoints (login, register). */
  auth: { limit: 10, windowMs: 60_000 },
  /** General API. */
  api: { limit: 120, windowMs: 60_000 },
  /** Read-heavy endpoints. */
  read: { limit: 200, windowMs: 60_000 },
  /** Write-heavy endpoints (POS, sales). */
  write: { limit: 60, windowMs: 60_000 },
  /** Super Admin. */
  admin: { limit: 30, windowMs: 60_000 },
} as const;
