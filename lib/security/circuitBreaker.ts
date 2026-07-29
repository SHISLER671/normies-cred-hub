// Emergency circuit breaker for payment paths.

import { createHash, randomBytes, timingSafeEqual } from "crypto"

import { Redis } from "@upstash/redis"

import { appendSecurityEvent } from "./audit"

export type CircuitState = "closed" | "open"

const KEY = "zulo:circuit:payments"
const APPROVALS_KEY = "zulo:circuit:unpause:approvals"

let redis: Redis | null | undefined
const mem = { state: "closed" as CircuitState, reason: "", at: 0 }

function getRedis(): Redis | null {
  if (redis !== undefined) return redis
  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN
  if (!url || !token) {
    redis = null
    return null
  }
  redis = new Redis({ url, token })
  return redis
}

function unpauseKeys(): string[] {
  const raw = process.env.CIRCUIT_BREAKER_UNPAUSE_KEYS?.trim()
  if (!raw) return []
  return raw
    .split(/[,\s]+/)
    .map((k) => k.trim())
    .filter(Boolean)
}

function threshold(): number {
  const n = Number(process.env.CIRCUIT_BREAKER_THRESHOLD ?? "3")
  return Number.isFinite(n) && n >= 1 ? Math.min(5, Math.floor(n)) : 3
}

function hashKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex")
}

export async function getCircuitState(): Promise<{
  state: CircuitState
  reason?: string
  trippedAt?: string
  paymentsPaused: boolean
}> {
  const client = getRedis()
  if (client) {
    try {
      const raw = await client.get<string>(KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as {
          state: CircuitState
          reason?: string
          at?: number
        }
        return {
          state: parsed.state === "open" ? "open" : "closed",
          reason: parsed.reason,
          trippedAt: parsed.at ? new Date(parsed.at).toISOString() : undefined,
          paymentsPaused: parsed.state === "open",
        }
      }
    } catch {
      /* mem */
    }
  }
  return {
    state: mem.state,
    reason: mem.reason || undefined,
    trippedAt: mem.at ? new Date(mem.at).toISOString() : undefined,
    paymentsPaused: mem.state === "open",
  }
}

/** SEV 1 — pause all payment verification acceptance. */
export async function tripCircuitBreaker(reason: string, caller?: string): Promise<void> {
  const payload = {
    state: "open" as const,
    reason: reason.slice(0, 500),
    at: Date.now(),
  }
  mem.state = "open"
  mem.reason = payload.reason
  mem.at = payload.at

  const client = getRedis()
  if (client) {
    try {
      await client.set(KEY, JSON.stringify(payload))
      await client.del(APPROVALS_KEY)
    } catch (e) {
      console.warn("[circuitBreaker] redis set failed", e)
    }
  }

  await appendSecurityEvent({
    type: "CIRCUIT_BREAKER_TRIP",
    caller,
    detail: payload.reason,
  })
}

/**
 * Multisig-style unpause: collect unique operator key approvals until threshold (default 3-of-5).
 * Keys are compared by SHA-256 hash of configured secrets — never log raw keys.
 */
export async function approveUnpause(
  operatorKey: string,
  caller?: string,
): Promise<{
  unpaused: boolean
  approvals: number
  required: number
}> {
  const keys = unpauseKeys()
  const required = Math.min(threshold(), Math.max(1, keys.length || threshold()))
  const provided = hashKey(operatorKey)

  const allowed = keys.map(hashKey)
  const ok = allowed.some((h) => {
    try {
      const a = Buffer.from(h, "hex")
      const b = Buffer.from(provided, "hex")
      return a.length === b.length && timingSafeEqual(a, b)
    } catch {
      return false
    }
  })

  if (!ok && keys.length > 0) {
    return { unpaused: false, approvals: 0, required }
  }

  // Dev fallback: if no keys configured, refuse unpause (fail closed)
  if (keys.length === 0) {
    return { unpaused: false, approvals: 0, required }
  }

  const client = getRedis()
  let approvals = 1

  if (client) {
    try {
      await client.sadd(APPROVALS_KEY, provided)
      approvals = (await client.scard(APPROVALS_KEY)) || 1
    } catch {
      /* count 1 */
    }
  }

  if (approvals >= required) {
    const payload = { state: "closed" as const, reason: "multisig unpause", at: Date.now() }
    mem.state = "closed"
    mem.reason = ""
    mem.at = payload.at
    if (client) {
      try {
        await client.set(KEY, JSON.stringify(payload))
        await client.del(APPROVALS_KEY)
      } catch {
        /* ignore */
      }
    }
    await appendSecurityEvent({
      type: "CIRCUIT_BREAKER_UNPAUSE",
      caller,
      detail: `approvals=${approvals} required=${required}`,
    })
    return { unpaused: true, approvals, required }
  }

  return { unpaused: false, approvals, required }
}

/** True when payment acceptance must refuse. */
export async function isPaymentsPaused(): Promise<boolean> {
  const s = await getCircuitState()
  return s.paymentsPaused
}

/** Anomaly helper — trip if explicit SEV1 flag or env lockdown. */
export async function maybeAutoLockdown(signal: {
  rateLimitHitsPerMin?: number
  failedPaymentsPerMin?: number
  caller?: string
}): Promise<boolean> {
  if (process.env.ZULO_FORCE_LOCKDOWN === "1") {
    await tripCircuitBreaker("ZULO_FORCE_LOCKDOWN=1", signal.caller)
    return true
  }
  // Heuristic thresholds (tunable)
  if ((signal.rateLimitHitsPerMin ?? 0) >= 200) {
    await tripCircuitBreaker("anomaly: rate limit storm", signal.caller)
    return true
  }
  if ((signal.failedPaymentsPerMin ?? 0) >= 50) {
    await tripCircuitBreaker("anomaly: payment failure storm", signal.caller)
    return true
  }
  return false
}

/** Dev/test helper — do not expose publicly without auth. */
export function __resetCircuitMemoryForTests() {
  mem.state = "closed"
  mem.reason = ""
  mem.at = 0
}

export function generateOperatorKeyMaterial(): string {
  return randomBytes(32).toString("hex")
}
