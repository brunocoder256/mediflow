/**
 * In-memory sliding-window rate limiter for Next.js API routes.
 *
 * In production (Vercel serverless), each isolate gets its own map — this is
 * acceptable because Vercel functions are short-lived and the window is small.
 * For stricter distributed limiting, swap the Map for an external store
 * (Redis / Upstash).
 */

type Entry = { count: number; resetAt: number };

const store = new Map<string, Entry>();

export interface RateLimitConfig {
  /** Unique key for this rule, e.g. "login" or "api/products". */
  key: string;
  /** Maximum number of requests allowed in the window. */
  limit: number;
  /** Window duration in milliseconds.  Default: 60 000 (1 min). */
  windowMs?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Returns whether the request is allowed under the given policy.
 * Call once per request. The key should include the client identifier
 * (IP or user-id) AND the rule name, e.g. `"login:203.0.113.1"`.
 */
export function rateLimit(cfg: RateLimitConfig & { clientKey: string }): RateLimitResult {
  const { clientKey, limit, windowMs = 60_000 } = cfg;
  const now = Date.now();
  const entry = store.get(clientKey);

  if (!entry || now > entry.resetAt) {
    // First request in this window (or window expired).
    store.set(clientKey, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  entry.count++;

  if (entry.count > limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

/**
 * Set standard rate-limit response headers on a NextResponse.
 */
export function setRateLimitHeaders(
  headers: Headers,
  result: RateLimitResult,
  limit: number,
) {
  headers.set("X-RateLimit-Limit", String(limit));
  headers.set("X-RateLimit-Remaining", String(result.remaining));
  headers.set("X-RateLimit-Reset", String(Math.ceil(result.resetAt / 1000)));
}
