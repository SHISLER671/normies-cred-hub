// Dual-keyed rate limiting for Zulo APIs (IP + wallet).
// Uses Upstash when configured; in-memory fallback for local.

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { ASK_DAILY_CAP, checkDailyCap, dailyCapMessage, type DailyCap } from "@/lib/middleware/dailyCap"
import { checkRateLimit, checkRateLimitById, getClientId } from "@/lib/ratelimit"
import { appendSecurityEvent } from "@/lib/security/audit"

export const RATE_LIMIT_MESSAGE = "Rate limit exceeded. Patience compounds."

export type RateLimitProfile = "default" | "ask" | "payment" | "security"

const PROFILES: Record<
  RateLimitProfile,
  { ip: number; wallet: number; windowSec: number; daily?: DailyCap }
> = {
  /** Per IP 60/min, per wallet 30/min */
  default: { ip: 60, wallet: 30, windowSec: 60 },
  /**
   * Ask spends inference credits on every call: 12/min per IP, 12/min per wallet (3/min each without Upstash in prod),
   * plus a daily cap per caller and for everyone combined (lib/middleware/dailyCap.ts).
   */
  ask: { ip: 12, wallet: 12, windowSec: 60, daily: ASK_DAILY_CAP },
  /** Stricter for payment verification */
  payment: { ip: 10, wallet: 10, windowSec: 60 },
  /** Vulnerability reports */
  security: { ip: 5, wallet: 5, windowSec: 60 },
}

function extractWallet(req: NextRequest, body?: unknown): string | undefined {
  const header =
    req.headers.get("x-wallet-address") ||
    req.headers.get("x-caller-wallet") ||
    undefined
  if (header && /^0x[a-fA-F0-9]{40}$/.test(header)) return header.toLowerCase()

  if (body && typeof body === "object") {
    const w = (body as Record<string, unknown>).userWallet
    if (typeof w === "string" && /^0x[a-fA-F0-9]{40}$/.test(w)) {
      return w.toLowerCase()
    }
  }
  return undefined
}

/**
 * Dual-key rate limit: IP and optional wallet both must pass. Profiles with a daily cap check it last, after the
 * per-minute limits, so a burst is turned away before it counts toward the day.
 */
export async function enforceDualRateLimit(
  req: NextRequest,
  profile: RateLimitProfile = "default",
  opts?: { body?: unknown; bucketPrefix?: string },
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const cfg = PROFILES[profile]
  const prefix = opts?.bucketPrefix ?? `zulo-${profile}`
  const ip = getClientId(req)
  const wallet = extractWallet(req, opts?.body)

  const ipResult = await checkRateLimit(req, `${prefix}-ip`, cfg.ip, cfg.windowSec)
  if (!ipResult.ok) {
    await appendSecurityEvent({
      type: "RATE_LIMIT_HIT",
      caller: ip,
      detail: `profile=${profile} key=ip retry=${ipResult.retryAfter}`,
    })
    return {
      ok: false,
      response: NextResponse.json(
        { error: RATE_LIMIT_MESSAGE, code: "rate_limit", retryable: true },
        {
          status: 429,
          headers: {
            "Retry-After": String(ipResult.retryAfter),
            "X-RateLimit-Scope": "ip",
          },
        },
      ),
    }
  }

  if (wallet) {
    const wResult = await checkRateLimitById(
      wallet,
      `${prefix}-wallet`,
      cfg.wallet,
      cfg.windowSec,
    )
    if (!wResult.ok) {
      await appendSecurityEvent({
        type: "RATE_LIMIT_HIT",
        caller: wallet,
        detail: `profile=${profile} key=wallet retry=${wResult.retryAfter}`,
      })
      return {
        ok: false,
        response: NextResponse.json(
          { error: RATE_LIMIT_MESSAGE, code: "rate_limit", retryable: true },
          {
            status: 429,
            headers: {
              "Retry-After": String(wResult.retryAfter),
              "X-RateLimit-Scope": "wallet",
            },
          },
        ),
      }
    }
  }

  if (cfg.daily) {
    const day = await checkDailyCap(checkRateLimitById, prefix, cfg.daily, { ip, wallet })
    if (!day.ok) {
      await appendSecurityEvent({
        type: "RATE_LIMIT_HIT",
        caller: day.scope === "wallet" && wallet ? wallet : ip,
        detail: `profile=${profile} key=day-${day.scope} retry=${day.retryAfter}`,
      })
      return {
        ok: false,
        response: NextResponse.json(
          { error: dailyCapMessage(day.scope), code: "daily_cap", retryable: false },
          {
            status: 429,
            headers: {
              "Retry-After": String(day.retryAfter),
              "X-RateLimit-Scope": `day-${day.scope}`,
            },
          },
        ),
      }
    }
  }

  return { ok: true }
}
