// Fire-and-forget Pulse + Paths usage events.
// Reuses Upstash Redis (same KV as rate limits / audit). Fail-open: never throw.

import { Redis } from "@upstash/redis"
import { after } from "next/server"
import type { NextRequest } from "next/server"

export const PULSE_RECENT_WINDOW_SEC = 900
/** Rolling window for Pulse level-5 usage signal. */
export const USAGE_LOOKBACK_DAYS = 14
export const USAGE_PULSE_CALLS_THRESHOLD = 8
export const USAGE_CONDITIONED_PATHS_THRESHOLD = 3
const DAY_TTL_SEC = 16 * 86_400
const EVENTS_MAX = 10_000
const METRICS_EVENTS_DEFAULT = 20

const KEY = {
  pulseCount: "usage:pulse:count",
  pathsCount: "usage:paths:count",
  conditionedCount: "usage:paths:conditioned",
  tokens: "usage:pulse:tokens",
  events: "usage:events",
  source: (source: PulseCallSource) => `usage:pulse:source:${source}`,
  recent: (tokenId: number) => `usage:pulse:recent:${tokenId}`,
  pulseDay: (tokenId: number, day: string) =>
    `usage:pulse:day:${tokenId}:${day}`,
  conditionedDay: (tokenId: number, day: string) =>
    `usage:paths:conditioned:day:${tokenId}:${day}`,
} as const

export type PulseCallSource = "get" | "post" | "tool"

export type PulseCallEvent = {
  type: "pulse_call"
  tokenId: number
  agentId?: number | null
  source: PulseCallSource
  callerWallet?: string | null
  timestamp: string
}

export type PathsCallEvent = {
  type: "paths_call"
  tokenId?: number | null
  intentTag?: string | null
  intentRaw?: string | null
  pathCount: number
  pulseConditioned: boolean
  pulseLevelAtTime?: number | null
  callerWallet?: string | null
  timestamp: string
}

export type PulseCallInput = {
  tokenId: number
  agentId?: number | null
  source: PulseCallSource
  callerWallet?: string | null
  pulseLevel?: number | null
}

export type PathsCallInput = {
  tokenId?: number | null
  intentTag?: string | null
  intentRaw?: string | null
  pathCount: number
  pulseLevelAtTime?: number | null
  callerWallet?: string | null
}

export type UsageMetrics = {
  ok: true
  pulseCalls: number
  pulseCallsBySource: { get: number; post: number; tool: number }
  uniqueTokenIds: number
  pathsCalls: number
  pulseConditionedPaths: number
  pulseConditionedRate: number | null
  recentWindowSec: number
  asOf: string
  events?: Array<Omit<PulseCallEvent, "callerWallet"> | Omit<PathsCallEvent, "callerWallet">>
}

type RecentPayload = {
  ts: string
  source: PulseCallSource
  pulseLevel?: number | null
  agentId?: number | null
}

const WALLET_RE = /^0x[a-fA-F0-9]{40}$/

let redis: Redis | null | undefined
let forceMemory = false

type MemRecent = { expiresAt: number; payload: string }
const memRecent = new Map<string, MemRecent>()
const memCounters = new Map<string, number>()
const memTokens = new Set<number>()
const memEvents: string[] = []

function getRedis(): Redis | null {
  if (forceMemory) return null
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

function toCount(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.floor(v))
  if (typeof v === "string" && /^\d+$/.test(v.trim())) return Number(v.trim())
  return 0
}

function parseWallet(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const w = raw.trim()
  return WALLET_RE.test(w) ? w.toLowerCase() : null
}

/** Header or body wallet, if it is a well-formed address. */
export function extractCallerWallet(
  req: NextRequest,
  body?: unknown,
): string | null {
  const header =
    req.headers.get("x-wallet-address") || req.headers.get("x-caller-wallet")
  const fromHeader = parseWallet(header)
  if (fromHeader) return fromHeader

  if (body && typeof body === "object") {
    const rec = body as Record<string, unknown>
    return parseWallet(rec.wallet) ?? parseWallet(rec.userWallet)
  }
  return null
}

function memIncr(key: string, by = 1): number {
  const next = (memCounters.get(key) ?? 0) + by
  memCounters.set(key, next)
  return next
}

function memGetCount(key: string): number {
  return memCounters.get(key) ?? 0
}

function memSetRecent(tokenId: number, payload: RecentPayload): void {
  memRecent.set(KEY.recent(tokenId), {
    expiresAt: Date.now() + PULSE_RECENT_WINDOW_SEC * 1000,
    payload: JSON.stringify(payload),
  })
}

function memHasRecent(tokenId: number): boolean {
  const entry = memRecent.get(KEY.recent(tokenId))
  if (!entry) return false
  if (Date.now() >= entry.expiresAt) {
    memRecent.delete(KEY.recent(tokenId))
    return false
  }
  return true
}

function memPushEvent(json: string): void {
  memEvents.unshift(json)
  if (memEvents.length > EVENTS_MAX) memEvents.length = EVENTS_MAX
}

function stripWallet<T extends { callerWallet?: string | null }>(
  event: T,
): Omit<T, "callerWallet"> {
  const { callerWallet: _w, ...rest } = event
  return rest
}

function parseEventJson(
  raw: unknown,
): PulseCallEvent | PathsCallEvent | null {
  try {
    const parsed =
      typeof raw === "string" ? (JSON.parse(raw) as unknown) : raw
    if (!parsed || typeof parsed !== "object") return null
    const rec = parsed as { type?: unknown }
    if (rec.type === "pulse_call" || rec.type === "paths_call") {
      return parsed as PulseCallEvent | PathsCallEvent
    }
    return null
  } catch {
    return null
  }
}

function utcDay(ms = Date.now()): string {
  return new Date(ms).toISOString().slice(0, 10)
}

function lookbackDays(n: number): string[] {
  const out: string[] = []
  const now = Date.now()
  for (let i = 0; i < n; i++) {
    out.push(utcDay(now - i * 86_400_000))
  }
  return out
}

async function incrDaily(
  client: Redis,
  key: string,
): Promise<void> {
  await client.incr(key)
  await client.expire(key, DAY_TTL_SEC)
}

export type TokenUsageSignal = {
  pulseCalls: number
  conditionedPaths: number
  earned: boolean
  lookbackDays: number
}

/**
 * Fail-open usage read for Pulse level 5.
 * Earned when recent Pulse calls or Pulse-conditioned Paths meet thresholds.
 */
export async function getTokenUsageSignal(
  tokenId: number,
): Promise<TokenUsageSignal> {
  const empty: TokenUsageSignal = {
    pulseCalls: 0,
    conditionedPaths: 0,
    earned: false,
    lookbackDays: USAGE_LOOKBACK_DAYS,
  }
  try {
    if (!Number.isInteger(tokenId) || tokenId < 0 || tokenId > 9999) {
      return empty
    }
    const days = lookbackDays(USAGE_LOOKBACK_DAYS)
    const pulseKeys = days.map((d) => KEY.pulseDay(tokenId, d))
    const condKeys = days.map((d) => KEY.conditionedDay(tokenId, d))
    const client = getRedis()
    let pulseCalls = 0
    let conditionedPaths = 0
    if (client) {
      const vals = await client.mget<(number | string | null)[]>(
        ...pulseKeys,
        ...condKeys,
      )
      const rows = Array.isArray(vals) ? vals : []
      for (let i = 0; i < days.length; i++) {
        pulseCalls += toCount(rows[i])
        conditionedPaths += toCount(rows[i + days.length])
      }
    } else {
      for (const d of days) {
        pulseCalls += memGetCount(KEY.pulseDay(tokenId, d))
        conditionedPaths += memGetCount(KEY.conditionedDay(tokenId, d))
      }
    }
    const earned =
      pulseCalls >= USAGE_PULSE_CALLS_THRESHOLD ||
      conditionedPaths >= USAGE_CONDITIONED_PATHS_THRESHOLD
    return {
      pulseCalls,
      conditionedPaths,
      earned,
      lookbackDays: USAGE_LOOKBACK_DAYS,
    }
  } catch (err) {
    console.warn("[instrumentation] getTokenUsageSignal failed", err)
    return empty
  }
}

async function hasRecentPulse(tokenId: number): Promise<boolean> {
  const client = getRedis()
  if (client) {
    const raw = await client.get<string | RecentPayload>(KEY.recent(tokenId))
    return raw != null && raw !== ""
  }
  return memHasRecent(tokenId)
}

/**
 * Log a successful Pulse response. Never throws.
 */
export async function recordPulseCall(input: PulseCallInput): Promise<void> {
  try {
    if (!Number.isInteger(input.tokenId) || input.tokenId < 0 || input.tokenId > 9999) {
      return
    }

    const timestamp = new Date().toISOString()
    const event: PulseCallEvent = {
      type: "pulse_call",
      tokenId: input.tokenId,
      agentId: input.agentId ?? null,
      source: input.source,
      callerWallet: input.callerWallet ?? null,
      timestamp,
    }
    const recent: RecentPayload = {
      ts: timestamp,
      source: input.source,
      pulseLevel: input.pulseLevel ?? null,
      agentId: input.agentId ?? null,
    }
    const json = JSON.stringify(event)

    const client = getRedis()
    const day = utcDay()
    if (client) {
      await Promise.all([
        client.set(KEY.recent(input.tokenId), JSON.stringify(recent), {
          ex: PULSE_RECENT_WINDOW_SEC,
        }),
        client.incr(KEY.pulseCount),
        client.incr(KEY.source(input.source)),
        client.sadd(KEY.tokens, input.tokenId),
        client.lpush(KEY.events, json),
        incrDaily(client, KEY.pulseDay(input.tokenId, day)),
      ])
      await client.ltrim(KEY.events, 0, EVENTS_MAX - 1)
      return
    }

    memSetRecent(input.tokenId, recent)
    memIncr(KEY.pulseCount)
    memIncr(KEY.source(input.source))
    memIncr(KEY.pulseDay(input.tokenId, day))
    memTokens.add(input.tokenId)
    memPushEvent(json)
  } catch (err) {
    console.warn("[instrumentation] recordPulseCall failed", err)
  }
}

/**
 * Log a successful Paths ranking. Checks the recent-Pulse TTL key.
 * Never throws.
 */
export async function recordPathsCall(input: PathsCallInput): Promise<boolean> {
  try {
    const tokenId =
      typeof input.tokenId === "number" &&
      Number.isInteger(input.tokenId) &&
      input.tokenId >= 0 &&
      input.tokenId <= 9999
        ? input.tokenId
        : null

    const pulseConditioned =
      tokenId != null ? await hasRecentPulse(tokenId) : false

    const timestamp = new Date().toISOString()
    const event: PathsCallEvent = {
      type: "paths_call",
      tokenId,
      intentTag: input.intentTag ?? null,
      intentRaw: input.intentRaw ? input.intentRaw.slice(0, 200) : null,
      pathCount: Math.max(0, Math.floor(input.pathCount) || 0),
      pulseConditioned,
      pulseLevelAtTime: input.pulseLevelAtTime ?? null,
      callerWallet: input.callerWallet ?? null,
      timestamp,
    }
    const json = JSON.stringify(event)

    const client = getRedis()
    const day = utcDay()
    if (client) {
      const ops: Array<Promise<unknown>> = [
        client.incr(KEY.pathsCount),
        client.lpush(KEY.events, json),
      ]
      if (pulseConditioned && tokenId != null) {
        ops.push(client.incr(KEY.conditionedCount))
        ops.push(incrDaily(client, KEY.conditionedDay(tokenId, day)))
      }
      await Promise.all(ops)
      await client.ltrim(KEY.events, 0, EVENTS_MAX - 1)
      return pulseConditioned
    }

    memIncr(KEY.pathsCount)
    if (pulseConditioned && tokenId != null) {
      memIncr(KEY.conditionedCount)
      memIncr(KEY.conditionedDay(tokenId, day))
    }
    memPushEvent(json)
    return pulseConditioned
  } catch (err) {
    console.warn("[instrumentation] recordPathsCall failed", err)
    return false
  }
}

export async function getUsageMetrics(opts?: {
  includeEvents?: boolean
  eventLimit?: number
}): Promise<UsageMetrics> {
  const asOf = new Date().toISOString()
  const empty: UsageMetrics = {
    ok: true,
    pulseCalls: 0,
    pulseCallsBySource: { get: 0, post: 0, tool: 0 },
    uniqueTokenIds: 0,
    pathsCalls: 0,
    pulseConditionedPaths: 0,
    pulseConditionedRate: null,
    recentWindowSec: PULSE_RECENT_WINDOW_SEC,
    asOf,
  }

  try {
    const client = getRedis()
    let pulseCalls = 0
    let pathsCalls = 0
    let conditioned = 0
    let uniqueTokenIds = 0
    let getCount = 0
    let postCount = 0
    let toolCount = 0
    let eventRows: unknown[] = []

    if (client) {
      const [pulse, paths, cond, unique, getSrc, postSrc, toolSrc] =
        await Promise.all([
          client.get<number | string>(KEY.pulseCount),
          client.get<number | string>(KEY.pathsCount),
          client.get<number | string>(KEY.conditionedCount),
          client.scard(KEY.tokens),
          client.get<number | string>(KEY.source("get")),
          client.get<number | string>(KEY.source("post")),
          client.get<number | string>(KEY.source("tool")),
        ])
      pulseCalls = toCount(pulse)
      pathsCalls = toCount(paths)
      conditioned = toCount(cond)
      uniqueTokenIds = toCount(unique)
      getCount = toCount(getSrc)
      postCount = toCount(postSrc)
      toolCount = toCount(toolSrc)

      if (opts?.includeEvents) {
        const n = Math.min(
          100,
          Math.max(1, opts.eventLimit ?? METRICS_EVENTS_DEFAULT),
        )
        eventRows = await client.lrange<string>(KEY.events, 0, n - 1)
      }
    } else {
      pulseCalls = memGetCount(KEY.pulseCount)
      pathsCalls = memGetCount(KEY.pathsCount)
      conditioned = memGetCount(KEY.conditionedCount)
      uniqueTokenIds = memTokens.size
      getCount = memGetCount(KEY.source("get"))
      postCount = memGetCount(KEY.source("post"))
      toolCount = memGetCount(KEY.source("tool"))
      if (opts?.includeEvents) {
        const n = Math.min(
          100,
          Math.max(1, opts.eventLimit ?? METRICS_EVENTS_DEFAULT),
        )
        eventRows = memEvents.slice(0, n)
      }
    }

    const pulseConditionedRate =
      pathsCalls > 0
        ? Math.round((conditioned / pathsCalls) * 1000) / 1000
        : null

    const metrics: UsageMetrics = {
      ok: true,
      pulseCalls,
      pulseCallsBySource: { get: getCount, post: postCount, tool: toolCount },
      uniqueTokenIds,
      pathsCalls,
      pulseConditionedPaths: conditioned,
      pulseConditionedRate,
      recentWindowSec: PULSE_RECENT_WINDOW_SEC,
      asOf,
    }

    if (opts?.includeEvents) {
      const events: NonNullable<UsageMetrics["events"]> = []
      for (const row of eventRows) {
        const parsed = parseEventJson(row)
        if (!parsed) continue
        if (parsed.type === "pulse_call") events.push(stripWallet(parsed))
        else events.push(stripWallet(parsed))
      }
      metrics.events = events
    }

    return metrics
  } catch (err) {
    console.warn("[instrumentation] getUsageMetrics failed", err)
    return empty
  }
}

/** Schedule usage work after the response (Next 16 `after`), else void. */
export function scheduleUsageWork(work: () => Promise<unknown>): void {
  const run = () => {
    void work().catch((err) => {
      console.warn("[instrumentation] usage work failed", err)
    })
  }

  try {
    after(run)
  } catch {
    run()
  }
}

/** Test-only: force the in-memory store and drop Redis. */
export function __forceMemoryStoreForTests(): void {
  forceMemory = true
  redis = null
  __resetUsageMemoryForTests()
}

/** Test-only: clear in-memory counters / recent keys / events. */
export function __resetUsageMemoryForTests(): void {
  memRecent.clear()
  memCounters.clear()
  memTokens.clear()
  memEvents.length = 0
}

/** Test-only: expire the recent-Pulse key for a token. */
export function __expirePulseRecentForTests(tokenId: number): void {
  memRecent.delete(KEY.recent(tokenId))
}
