// Polite reader for the official Arena API (Claude, 2026-11-17).
//
// Every public GET under api.normies.art/arena/* that NCH may read, from the official docs
// (https://api.normies.art/llms.txt, "## Arena", read 2026-11-17). Ryan asked for the whole Arena API, read politely:
//
//   - Read on demand only: when someone opens a record card. No crawling of every Normie, no browser polling, no cron.
//   - One shared server cache per URL: ARENA_API_REVALIDATE_SECONDS (60 s), six times longer than the API's own
//     `s-maxage=10` for /arena/*. However many people look, NCH asks the API for one URL at most about once a minute.
//   - Backs off when asked: a 429 or 503 pauses that endpoint family for its Retry-After (or a minute, at most ten);
//     three failures in a row pause it for a minute. While paused NCH doesn't call at all and says it couldn't read.
//   - Every call has a time limit and a size cap (fetchJsonWithLimits), and says who it is (ARENA_API_USER_AGENT).
//   - Paths are allowlisted with their documented query keys; nothing from user input reaches the URL unchecked.
//
// Money: the Arena API reports #PIXEL balances, prizes, refunds, pools and charges. This file returns raw bodies; the
// parsers that read them pick named fields only. Under AGENTS.md "Numbers yes, advice never" the one amount NCH shows
// is the current round's pool total (lib/record-card/arena.ts, parseArenaRoundPool); no other amount is read.
// The two money-only endpoints (/arena/rounds/{round}/winners and /refunds) are deliberately not on the allowlist.

import { NORMIES_API_BASE } from "@/constants/contracts"
import { fetchJsonWithLimits } from "@/lib/fetch-with-timeout"
import { siteOrigin } from "@/lib/site-origin"

export const ARENA_API_DOCS = "https://api.normies.art/llms.txt"
/** Shared cache per URL. The API's own header for /arena/* is `public, max-age=10, s-maxage=10`. */
export const ARENA_API_REVALIDATE_SECONDS = 60
export const ARENA_API_TIMEOUT_MS = 8_000
export const ARENA_API_MAX_BYTES = 1_000_000
export const ARENA_API_DEFAULT_PAUSE_MS = 60_000
export const ARENA_API_MAX_PAUSE_MS = 10 * 60_000
export const ARENA_API_FAILURES_BEFORE_PAUSE = 3

/** Plain, honest identification for the Normies team's logs. */
export function arenaApiUserAgent(): string {
  return `NormiesCredHub (read-only Normie record cards; +${siteOrigin()})`
}

const TOKEN = "(?:0|[1-9]\\d{0,3})" // 0-9999, no leading zeros
const ROUND = "(?:0|[1-9]\\d{0,5})"
const ADDRESS = "0x[0-9a-fA-F]{40}"
const PAGE = ["limit", "offset"] as const

type Route = { name: string; path: RegExp; query: readonly string[] }

/** Allowlisted Arena endpoints, as documented. The family name is also the backoff key. */
export const ARENA_API_ROUTES: readonly Route[] = [
  { name: "status", path: /^\/arena\/status$/, query: [] },
  { name: "rounds", path: /^\/arena\/rounds$/, query: ["status", "sort", ...PAGE] },
  { name: "round", path: new RegExp(`^/arena/rounds/${ROUND}$`), query: [] },
  { name: "round-players", path: new RegExp(`^/arena/rounds/${ROUND}/players$`), query: [...PAGE] },
  { name: "registered", path: /^\/arena\/registered$/, query: ["state", ...PAGE] },
  { name: "normie", path: new RegExp(`^/arena/normie/${TOKEN}$`), query: [] },
  { name: "normie-rounds", path: new RegExp(`^/arena/normie/${TOKEN}/rounds$`), query: [...PAGE] },
  { name: "normie-activity", path: new RegExp(`^/arena/normie/${TOKEN}/activity$`), query: [...PAGE] },
  { name: "holder", path: new RegExp(`^/arena/holder/${ADDRESS}$`), query: [] },
  { name: "activity", path: /^\/arena\/activity$/, query: ["kind", "source", "round", "tokenId", "address", ...PAGE] },
  { name: "skins", path: /^\/arena\/skins$/, query: ["buyer", ...PAGE] },
  { name: "normie-skins", path: new RegExp(`^/arena/skins/normie/${TOKEN}$`), query: [] },
  { name: "records", path: /^\/arena\/records$/, query: ["sort", ...PAGE] },
]

const QUERY_VALUE = /^[A-Za-z0-9_-]{1,64}$/

/** The allowlisted route for a path (with optional query), or null. Rejects unknown keys, odd values and repeats. */
export function resolveArenaPath(pathWithQuery: string): { route: Route; path: string } | null {
  if (typeof pathWithQuery !== "string" || !pathWithQuery.startsWith("/arena/") || pathWithQuery.includes("..")) return null
  let url: URL
  try {
    url = new URL(pathWithQuery, NORMIES_API_BASE)
  } catch {
    return null
  }
  if (url.origin !== NORMIES_API_BASE || url.hash) return null
  const route = ARENA_API_ROUTES.find((r) => r.path.test(url.pathname))
  if (!route) return null
  const seen = new Set<string>()
  for (const [key, value] of url.searchParams) {
    if (!route.query.includes(key) || seen.has(key) || !QUERY_VALUE.test(value)) return null
    seen.add(key)
  }
  return { route, path: `${url.pathname}${url.search}` }
}

/** Retry-After as milliseconds: seconds or an HTTP date, clamped to 1 s .. ARENA_API_MAX_PAUSE_MS. */
export function retryAfterMs(value: string | undefined, now: number): number {
  if (!value) return ARENA_API_DEFAULT_PAUSE_MS
  const trimmed = value.trim()
  let ms: number
  if (/^\d+$/.test(trimmed)) ms = Number(trimmed) * 1000
  else {
    const at = Date.parse(trimmed)
    if (!Number.isFinite(at)) return ARENA_API_DEFAULT_PAUSE_MS
    ms = at - now
  }
  return Math.min(Math.max(ms, 1000), ARENA_API_MAX_PAUSE_MS)
}

export type ArenaApiResult =
  | { ok: true; status: number; data: unknown }
  | { ok: false; status: number; reason: "not_allowed" | "paused" | "http" | "error" }

type Health = { pausedUntil: number; failures: number }

export type ArenaApiDeps = { fetchImpl?: typeof fetch; now?: () => number }

/** A polite Arena reader with its own backoff memory. The app uses the shared one (`arenaGet`); tests make their own. */
export function createArenaApi(deps: ArenaApiDeps = {}) {
  const health = new Map<string, Health>()
  const now = deps.now ?? Date.now

  function pause(family: string, ms: number) {
    health.set(family, { pausedUntil: now() + ms, failures: 0 })
  }

  async function get(pathWithQuery: string): Promise<ArenaApiResult> {
    const resolved = resolveArenaPath(pathWithQuery)
    if (!resolved) return { ok: false, status: 0, reason: "not_allowed" }
    const family = resolved.route.name
    const h = health.get(family)
    if (h && h.pausedUntil > now()) return { ok: false, status: 0, reason: "paused" }

    let res: Awaited<ReturnType<typeof fetchJsonWithLimits>>
    try {
      res = await fetchJsonWithLimits(
        `${NORMIES_API_BASE}${resolved.path}`,
        {
          headers: { Accept: "application/json", "User-Agent": arenaApiUserAgent() },
          next: { revalidate: ARENA_API_REVALIDATE_SECONDS },
        } as RequestInit,
        { timeoutMs: ARENA_API_TIMEOUT_MS, maxBytes: ARENA_API_MAX_BYTES, fetchImpl: deps.fetchImpl },
      )
    } catch {
      const failures = (h?.failures ?? 0) + 1
      if (failures >= ARENA_API_FAILURES_BEFORE_PAUSE) pause(family, ARENA_API_DEFAULT_PAUSE_MS)
      else health.set(family, { pausedUntil: 0, failures })
      return { ok: false, status: 0, reason: "error" }
    }

    if (res.ok) {
      health.delete(family)
      return { ok: true, status: res.status, data: res.data }
    }
    if (res.status === 429 || res.status === 503) {
      pause(family, retryAfterMs(res.retryAfter, now()))
    } else if (res.status >= 500) {
      const failures = (h?.failures ?? 0) + 1
      if (failures >= ARENA_API_FAILURES_BEFORE_PAUSE) pause(family, ARENA_API_DEFAULT_PAUSE_MS)
      else health.set(family, { pausedUntil: 0, failures })
    }
    // 404 and other 4xx are answers ("not configured", "not found"), not a reason to back off.
    return { ok: false, status: res.status, reason: "http" }
  }

  return { get }
}

const shared = createArenaApi()

/** GET an allowlisted Arena path through the shared, polite reader. */
export function arenaGet(pathWithQuery: string): Promise<ArenaApiResult> {
  return shared.get(pathWithQuery)
}
