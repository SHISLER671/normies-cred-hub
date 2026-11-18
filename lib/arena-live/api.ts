// Polite reader for the Arena site's own public GET routes (Claude, 2026-11-18). Read-only.
//
// These routes are on arena.normies.art, the Arena app, not the official api.normies.art that lib/arena-api.ts reads.
// Only `/api/world/normie/{id}` is listed in the Arena site's llms.txt; `standing` and `arena-week` are public but
// undocumented, so they can change without notice (the parsers in ./core.ts refuse any changed shape).
//
// Same manners as lib/arena-api.ts, and the same constants and helpers imported from it:
//   - A fixed list of three routes. Nothing from user input reaches the URL unchecked. `standing` takes exactly one id.
//   - One shared server cache per URL (ARENA_API_REVALIDATE_SECONDS, 60 s).
//   - Backs off when asked: a 429 or 503 pauses that route for its Retry-After (retryAfterMs); three failures in a row
//     pause it for a minute. While paused NCH doesn't call at all.
//   - Every call has a time limit (5 s) and the same size cap, and says who it is (arenaApiUserAgent).
// Never called: the `/api/world/live` stream, the board route, any POST, finance or admin route.
//
// The backoff bookkeeping below repeats the few lines in createArenaApi, because that function is tied to
// api.normies.art's base and route list and lib/arena-api.ts was outside this task's contract. A shared factory is a
// later cleanup.

import {
  ARENA_API_DEFAULT_PAUSE_MS,
  ARENA_API_FAILURES_BEFORE_PAUSE,
  ARENA_API_MAX_BYTES,
  ARENA_API_REVALIDATE_SECONDS,
  arenaApiUserAgent,
  retryAfterMs,
} from "@/lib/arena-api"
import { fetchJsonWithLimits } from "@/lib/fetch-with-timeout"
import { ARENA_SITE } from "@/lib/official-status"

export const ARENA_LIVE_BASE = ARENA_SITE
export const ARENA_LIVE_TIMEOUT_MS = 5_000

const TOKEN = "(?:0|[1-9]\\d{0,3})" // 0-9999, no leading zeros

type Route = { name: "normie" | "standing" | "arena-week"; path: RegExp; query: RegExp }

/** The only Arena site routes NCH reads. The name is also the backoff key. */
export const ARENA_LIVE_ROUTES: readonly Route[] = [
  { name: "normie", path: new RegExp(`^/api/world/normie/${TOKEN}$`), query: /^$/ },
  { name: "standing", path: /^\/api\/world\/standing$/, query: new RegExp(`^\\?ids=${TOKEN}$`) },
  { name: "arena-week", path: /^\/api\/world\/arena-week$/, query: /^$/ },
]

/** The allowlisted route for a path (with its query), or null. */
export function resolveArenaLivePath(pathWithQuery: string): { route: Route; path: string } | null {
  if (typeof pathWithQuery !== "string" || !pathWithQuery.startsWith("/api/world/") || pathWithQuery.includes("..")) return null
  let url: URL
  try {
    url = new URL(pathWithQuery, ARENA_LIVE_BASE)
  } catch {
    return null
  }
  if (url.origin !== ARENA_LIVE_BASE || url.hash) return null
  const route = ARENA_LIVE_ROUTES.find((r) => r.path.test(url.pathname) && r.query.test(url.search))
  return route ? { route, path: `${url.pathname}${url.search}` } : null
}

export type ArenaLiveResult =
  | { ok: true; status: number; data: unknown }
  | { ok: false; status: number; reason: "not_allowed" | "paused" | "http" | "error" }

type Health = { pausedUntil: number; failures: number }

export type ArenaLiveDeps = { fetchImpl?: typeof fetch; now?: () => number }

/** A polite Arena-site reader with its own backoff memory. The app uses the shared one (`arenaLiveGet`); tests make their own. */
export function createArenaLiveApi(deps: ArenaLiveDeps = {}) {
  const health = new Map<string, Health>()
  const now = deps.now ?? Date.now
  const pause = (family: string, ms: number) => health.set(family, { pausedUntil: now() + ms, failures: 0 })
  const failed = (family: string, h: Health | undefined) => {
    const failures = (h?.failures ?? 0) + 1
    if (failures >= ARENA_API_FAILURES_BEFORE_PAUSE) pause(family, ARENA_API_DEFAULT_PAUSE_MS)
    else health.set(family, { pausedUntil: 0, failures })
  }

  async function get(pathWithQuery: string): Promise<ArenaLiveResult> {
    const resolved = resolveArenaLivePath(pathWithQuery)
    if (!resolved) return { ok: false, status: 0, reason: "not_allowed" }
    const family = resolved.route.name
    const h = health.get(family)
    if (h && h.pausedUntil > now()) return { ok: false, status: 0, reason: "paused" }

    let res: Awaited<ReturnType<typeof fetchJsonWithLimits>>
    try {
      res = await fetchJsonWithLimits(
        `${ARENA_LIVE_BASE}${resolved.path}`,
        {
          headers: { Accept: "application/json", "User-Agent": arenaApiUserAgent() },
          next: { revalidate: ARENA_API_REVALIDATE_SECONDS },
        } as RequestInit,
        { timeoutMs: ARENA_LIVE_TIMEOUT_MS, maxBytes: ARENA_API_MAX_BYTES, fetchImpl: deps.fetchImpl },
      )
    } catch {
      failed(family, h)
      return { ok: false, status: 0, reason: "error" }
    }

    if (res.ok) {
      health.delete(family)
      return { ok: true, status: res.status, data: res.data }
    }
    if (res.status === 429 || res.status === 503) pause(family, retryAfterMs(res.retryAfter, now()))
    else if (res.status >= 500) failed(family, h)
    return { ok: false, status: res.status, reason: "http" }
  }

  return { get }
}

const shared = createArenaLiveApi()

/** GET an allowlisted Arena-site path through the shared, polite reader. */
export function arenaLiveGet(pathWithQuery: string): Promise<ArenaLiveResult> {
  return shared.get(pathWithQuery)
}
