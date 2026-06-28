import { Redis } from "@upstash/redis"
import { Ratelimit } from "@upstash/ratelimit"
import type { NextRequest } from "next/server"

/**
 * Shared Upstash-backed rate limiting for the public AI endpoints.
 *
 * These routes spend Venice credits on every call, so they must be protected
 * from abuse / runaway loops. Limits are sliding-window and per-identifier
 * (client IP by default).
 *
 * If Upstash env vars are missing (e.g. local dev without the integration),
 * `getRateLimiter` returns null and callers should fail open so the app still
 * works — production always has the vars set by the integration.
 */

let redis: Redis | null = null

function getRedis(): Redis | null {
  if (redis) return redis
  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN
  if (!url || !token) return null
  redis = new Redis({ url, token })
  return redis
}

// Cache limiter instances per "bucket" so we don't rebuild them each request.
const limiters = new Map<string, Ratelimit>()

/**
 * @param bucket   logical name for the limited resource (e.g. "horizon")
 * @param limit    max requests allowed per window
 * @param windowSec sliding window size in seconds
 */
export function getRateLimiter(bucket: string, limit: number, windowSec: number): Ratelimit | null {
  const client = getRedis()
  if (!client) return null

  const key = `${bucket}:${limit}:${windowSec}`
  let limiter = limiters.get(key)
  if (!limiter) {
    limiter = new Ratelimit({
      redis: client,
      limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
      analytics: true,
      prefix: `ratelimit:${bucket}`,
    })
    limiters.set(key, limiter)
  }
  return limiter
}

/** Best-effort client identifier from proxy headers, falling back to a constant. */
export function getClientId(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for")
  if (fwd) return fwd.split(",")[0]!.trim()
  return req.headers.get("x-real-ip") || "anonymous"
}

/**
 * Convenience guard. Returns null when the request is allowed, or a
 * Response-shaped object describing the 429 when the limit is exceeded.
 * Fails open (allows) if Upstash isn't configured.
 */
export async function checkRateLimit(
  req: NextRequest,
  bucket: string,
  limit: number,
  windowSec: number,
): Promise<{ ok: true } | { ok: false; retryAfter: number }> {
  const limiter = getRateLimiter(bucket, limit, windowSec)
  if (!limiter) return { ok: true }

  const id = getClientId(req)
  const { success, reset } = await limiter.limit(id)
  if (success) return { ok: true }

  const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000))
  return { ok: false, retryAfter }
}
