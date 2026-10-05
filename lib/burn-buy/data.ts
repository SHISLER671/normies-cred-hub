// Real data sources for the burn/buy answer. Kept thin on purpose: all decisions live in the tested pure modules.
// Upstream limit: api.normies.art allows 60 requests/min per IP, so everything here is cached
// (Next data cache plus a short in-process cache) and listings are shared across visitors.

import { NORMIES_API_BASE } from "@/constants/contracts"
import { delegationCheckIncomplete, findDelegateXyz, registryReaders } from "@/lib/delegations"
import { loadBurnContractStatus } from "./contract-state"
import { publicClient } from "@/lib/viem-client"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getSupabase } from "@/lib/db/supabase"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"

import { fetchJevOpinions } from "./jev"
import { cachedContractStatus } from "./contract-cache"
import { currentMarket, currentYieldMode, currentYieldPinned, marketPin } from "./switches"
import { walletScore } from "./score"
import { ttl } from "./ttl"
import { SourceError, type Deps, type MarketSnapshot, type RarityToken, type RawListing } from "./service"

const RARITY = `${NORMIES_API_BASE}/rarity`
const HEADERS = { Accept: "application/json" }

interface RawItem {
  id: number
  rank?: number | null
  attributes?: Array<{ trait_type: string; value: string | number }>
  fairValue?: number | null
  awake?: boolean
  listing?: { priceEth?: number; url?: string } | null
}

const attr = (it: RawItem, name: string) => it.attributes?.find((a) => a.trait_type === name)?.value
const num = (v: unknown): number | null => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v))

function toToken(it: RawItem): RarityToken {
  return {
    id: Number(it.id),
    rank: num(it.rank),
    type: attr(it, "Type") !== undefined ? String(attr(it, "Type")) : null,
    actionPoints: num(attr(it, "Action Points")) ?? 0,
    awakenedAgent: Boolean(it.awake),
    fairValueEth: num(it.fairValue),
    traits: Object.fromEntries((it.attributes ?? []).map((a) => [a.trait_type, a.value])),
    customized: attr(it, "Customized") === "Yes",
  }
}

async function getJson<T>(url: string, source: SourceError["source"], revalidate: number): Promise<T> {
  let res: Response
  try {
    // revalidate 0 means "fresh": skip Next's data cache (used for the one retry, so a bad cached answer cannot be served twice).
    res = await fetchWithTimeout(url, { headers: HEADERS, ...(revalidate === 0 ? { cache: "no-store" as const } : { next: { revalidate } }) }, 10_000)
  } catch (e) {
    throw new SourceError(source, `${source} request failed: ${e instanceof Error ? e.message : e}`)
  }
  if (res.status === 429) throw new SourceError(source, `${source} is rate limiting us; try again shortly`)
  if (!res.ok) throw new SourceError(source, `${source} returned HTTP ${res.status}`)
  return (await res.json()) as T
}

async function resolveHolder(input: string) {
  let res: Response
  try {
    res = await fetchWithTimeout(`${RARITY}/holder/${encodeURIComponent(input)}`, { headers: HEADERS, next: { revalidate: 30 } }, 10_000)
  } catch (e) {
    throw new SourceError("holder", `holder lookup failed: ${e instanceof Error ? e.message : e}`)
  }
  if (res.status === 400 || res.status === 404) {
    throw new SourceError("holder", "That is not a valid wallet address or ENS name.", "invalid-input")
  }
  if (res.status === 429) throw new SourceError("holder", "holder lookup is rate limiting us; try again shortly")
  if (!res.ok) throw new SourceError("holder", `holder lookup returned HTTP ${res.status}`)
  const d = (await res.json()) as { address?: string; tokenIds?: Array<number | string>; ens?: string | null }
  if (!d.address) throw new SourceError("holder", "holder lookup returned no address")
  const tokenIds = (d.tokenIds ?? []).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 9999)
  return { address: d.address, ens: d.ens ?? null, tokenIds }
}

async function fetchTokens(ids: number[]): Promise<RarityToken[]> {
  const out: RarityToken[] = []
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100)
    const d = await getJson<{ items?: RawItem[] }>(
      `${RARITY}/normies?wallet_ids=${chunk.join(",")}&limit=100&sort=rank&order=asc`,
      "rarity",
      30,
    )
    for (const it of d.items ?? []) out.push(toToken(it))
  }
  return out
}

type ListingsPage = { items?: RawItem[]; total?: number; totalPages?: number; floorPrice?: number }

/** Pages 2..N are independent of each other, so they are fetched together; page order (cheapest first) is kept. */
export async function loadListings(getPage: (page: number) => Promise<ListingsPage>) {
  const first = await getPage(1)
  const lastPage = Math.min(Math.max(first.totalPages ?? 1, 1), 8)
  const rest = await Promise.all(Array.from({ length: lastPage - 1 }, (_, i) => getPage(i + 2)))
  const items: RawListing[] = []
  for (const d of [first, ...rest]) {
    for (const it of d.items ?? []) {
      const price = num(it.listing?.priceEth)
      if (price && price > 0) items.push({ ...toToken(it), priceEth: price, url: it.listing?.url })
    }
  }
  return { items, floorEth: num(first.floorPrice), total: first.total ?? 0 }
}

/** Rejects with `message` if `p` has not settled within `ms`. The caller decides what a timeout means. */
export function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms)
  })
  return Promise.race([p, timeout]).finally(() => { if (timer) clearTimeout(timer) })
}

/**
 * Listings are OPTIONAL, so they get a hard time cap well inside the page's 20 s budget. A slow listings source then
 * costs a warning, not the whole page.
 */
export const LISTINGS_BUDGET_MS = 6_000
/** The index snapshot is REQUIRED; cap it so a hung database gives our friendly error, not a platform 504. */
export const SNAPSHOT_BUDGET_MS = 8_000

/**
 * A listings answer with no usable priced listing is treated as a FAILURE, not as "the market is empty".
 * Throwing here does two things: the TTL cache does not keep the empty answer for a minute, and the service marks
 * listings as down so the page says so (live bug seen 2026-10-04 21:55 UTC: moves and the fodder table vanished
 * for one load with no warning, then came back).
 */
export async function requireListings<T extends { items: unknown[]; total: number }>(load: () => Promise<T>): Promise<T> {
  const r = await load()
  if (r.items.length === 0) {
    throw new SourceError("listings", r.total > 0 ? "listings came back without usable prices" : "no listings came back")
  }
  return r
}

/**
 * One automatic retry. Live 2026-10-05: the listings source sometimes answers empty for a single request (then fine on the next),
 * and the first visitor after a quiet moment saw "listings did not load". The retry is short, skips the data cache, and only runs after a failure.
 */
export async function withOneRetry<T>(attempt: (fresh: boolean) => Promise<T>, pauseMs = 300): Promise<T> {
  try {
    return await attempt(false)
  } catch {
    await new Promise((r) => setTimeout(r, pauseMs))
    return attempt(true)
  }
}

const listingsCached = ttl(60_000, () =>
  withTimeout(
    withOneRetry((fresh) =>
      requireListings(() =>
        loadListings((page) =>
          getJson<ListingsPage>(`${RARITY}/normies?listed=1&limit=100&page=${page}&sort=price&order=asc`, "listings", fresh ? 0 : 60),
        ),
      ),
    ),
    LISTINGS_BUDGET_MS,
    `listings took longer than ${LISTINGS_BUDGET_MS / 1000} s`,
  ),
)

export interface IndexRow {
  token_id: number
  owner: string | null
  action_points: number | null
  on_pixels: number | null
  indexed_at: string | null
}

/** Token ids run 0..9999. The index is read in this many equal id-ranges, all at once. */
export const INDEX_TOKEN_SPAN = 10_000
export const INDEX_CHUNK = 1_000

/**
 * Every living token's row, read as 10 id-ranges IN PARALLEL (it used to be ~8 pages one after another, about 4 s cold).
 * A range of 1,000 ids can never return more than 1,000 rows, so the database's per-request row cap cannot truncate it.
 */
export async function fetchIndexRows(db: Pick<SupabaseClient, "from">): Promise<IndexRow[]> {
  const ranges = Array.from({ length: INDEX_TOKEN_SPAN / INDEX_CHUNK }, (_, i) => i * INDEX_CHUNK)
  const chunks = await Promise.all(
    ranges.map(async (from) => {
      const { data, error } = await db
        .from("normie_index")
        .select("token_id,owner,action_points,on_pixels,indexed_at")
        .eq("burned", false)
        .gte("token_id", from)
        .lt("token_id", from + INDEX_CHUNK)
        .order("token_id")
      if (error) throw new Error(error.message)
      return (data ?? []) as IndexRow[]
    }),
  )
  return chunks.flat()
}

/** When each scheduled refresh last SUCCEEDED (public.census_sync). Null for a job that has not run yet. */
export interface SyncStamps { census: string | null; owners: string | null }

/** Reads the freshness stamps. Never throws: if they cannot be read the caller falls back to the oldest row's time. */
export async function fetchSyncStamps(db: Pick<SupabaseClient, "from">): Promise<SyncStamps> {
  const none: SyncStamps = { census: null, owners: null }
  try {
    const { data, error } = await db.from("census_sync").select("job,synced_at")
    if (error || !data) return none
    const at = (job: string) => {
      const v = (data as Array<{ job: string; synced_at: string }>).find((r) => r.job === job)?.synced_at ?? null
      return v && v >= "2020-01-01" ? v : null // the placeholder row of a job that never succeeded reads as "no stamp"
    }
    return { census: at("census"), owners: at("owners") }
  } catch {
    return none
  }
}

/** The honest "as of": the OLDER of the two refresh stamps once both jobs have run, otherwise the oldest row's time. */
export function freshnessOf(stamps: SyncStamps | undefined, oldestRow: string | null): string | null {
  if (stamps?.census && stamps?.owners) return stamps.census < stamps.owners ? stamps.census : stamps.owners
  return oldestRow
}

/** Pure: turns index rows into the snapshot the advice needs. */
export function snapshotFromRows(rows: IndexRow[], stamps?: SyncStamps): MarketSnapshot {
  const originalPixels = new Map<number, number>()
  const pixelSupply = new Map<number, number>()
  const wallets = new Map<string, { n: number; ap: number }>()
  let oldest: string | null = null
  for (const r of rows) {
    if (r.on_pixels === null || r.on_pixels === undefined) continue
    originalPixels.set(r.token_id, r.on_pixels)
    pixelSupply.set(r.on_pixels, (pixelSupply.get(r.on_pixels) ?? 0) + 1)
    if (r.owner) {
      const w = wallets.get(r.owner) ?? { n: 0, ap: 0 }
      w.n += 1
      w.ap += r.action_points ?? 0
      wallets.set(r.owner, w)
    }
    if (r.indexed_at && (oldest === null || r.indexed_at < oldest)) oldest = r.indexed_at
  }
  if (originalPixels.size === 0) throw new Error("index returned no living tokens")
  let censusTotal = 0
  const walletScores = new Map<string, number>()
  for (const [owner, w] of wallets) {
    const sc = walletScore(w.n, w.ap)
    walletScores.set(owner.toLowerCase(), sc)
    censusTotal += sc
  }
  return { livingSupply: originalPixels.size, wallets: wallets.size, censusTotal, originalPixels, pixelSupply, oldestIndexedAt: freshnessOf(stamps, oldest), walletScores }
}

/** Every living token's original pixels, plus the census. Reads the public, read-only normie_index. */
const snapshotCached = ttl(10 * 60_000, async (): Promise<MarketSnapshot> => {
  const db = getSupabase()
  if (!db) throw new Error("database is not configured")
  const [rows, stamps] = await withTimeout(
    Promise.all([fetchIndexRows(db), fetchSyncStamps(db)]),
    SNAPSHOT_BUDGET_MS,
    `the index took longer than ${SNAPSHOT_BUDGET_MS / 1000} s`,
  )
  return snapshotFromRows(rows, stamps)
})

/** Tokens for which `address` is the Canvas delegate, from the index. Only ever called with a validated 0x address. */
async function canvasDelegations(address: string): Promise<Array<{ tokenId: number; owner: string }>> {
  const db = getSupabase()
  if (!db) throw new Error("database is not configured")
  const { data, error } = await db
    .from("normie_index")
    .select("token_id,owner")
    .eq("burned", false)
    .eq("delegate", address.toLowerCase())
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({ tokenId: r.token_id, owner: r.owner }))
}

/** Token ids a vault holds, from the Normies API. Ids come back as numbers or numeric strings. */
async function vaultHoldings(vault: string): Promise<Array<number | string>> {
  const d = await getJson<{ tokenIds?: Array<number | string> }>(`${NORMIES_API_BASE}/holders/${vault}`, "holder", 30)
  return d.tokenIds ?? []
}

/**
 * Every Normie this wallet is a DELEGATE for, from both places a delegation can live: Canvas (the index) and Delegate.xyz
 * (both registries, read from the chain; see lib/delegations.ts). The answer is the union. If a check could not be completed AND
 * nothing was found, this throws, because "not a delegate" would not be a fact; if something was found it is returned.
 */
export function findDelegations(address: string) {
  return delegationsCached(address)
}

type Delegation = { tokenId: number; owner: string; via?: "canvas" | "delegate.xyz" | "both" }

/**
 * One shared answer per key for `ms`, including concurrent callers; a FAILED load is dropped at once (never kept), and the map is
 * emptied when it reaches `max` entries. Used so the same address (the example wallet above all, which is not rate limited)
 * does not cost two chain reads and a holder lookup on every page view.
 */
export function keyedTtl<T>(ms: number, max: number, load: (key: string) => Promise<T>, now: () => number = Date.now): (key: string) => Promise<T> {
  const cache = new Map<string, { at: number; value: Promise<T> }>()
  return (key) => {
    const hit = cache.get(key)
    if (hit && now() - hit.at < ms) return hit.value
    if (cache.size >= max) cache.clear()
    const value = load(key)
    const entry = { at: now(), value }
    cache.set(key, entry)
    value.catch(() => { if (cache.get(key) === entry) cache.delete(key) })
    return value
  }
}

const delegationsByAddress = keyedTtl(60_000, 500, (key) => lookupDelegations(key))
const delegationsCached = (address: string): Promise<Delegation[]> => delegationsByAddress(address.toLowerCase())

async function lookupDelegations(address: string): Promise<Delegation[]> {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return []
  // The zero address is how "no delegate" is stored (18 index rows hold it), so it is never a real delegate. Without this, pasting it
  // claimed "this wallet is the Canvas delegate for 17 Normies".
  if (/^0x0+$/i.test(address)) return []
  const [canvas, dx] = await Promise.allSettled([
    canvasDelegations(address),
    findDelegateXyz(address, { ...registryReaders(publicClient), holdersOf: vaultHoldings }),
  ])
  const merged = new Map<number, { tokenId: number; owner: string; via?: "canvas" | "delegate.xyz" | "both" }>()
  let incomplete = false
  if (canvas.status === "fulfilled") for (const c of canvas.value) merged.set(c.tokenId, { tokenId: c.tokenId, owner: c.owner })
  else incomplete = true
  if (dx.status === "fulfilled") {
    for (const e of dx.value.entries) {
      const have = merged.get(e.tokenId)
      merged.set(e.tokenId, have ? { ...have, via: "both" } : { tokenId: e.tokenId, owner: e.vault, via: "delegate.xyz" })
    }
    if (delegationCheckIncomplete(dx.value)) incomplete = true
  } else incomplete = true
  const out = [...merged.values()].sort((a, b) => a.tokenId - b.tokenId)
  if (out.length === 0 && incomplete) throw new Error("a delegation check (Canvas index or Delegate.xyz) could not be completed")
  return out
}

export const realDeps: Deps = {

  resolveHolder,
  fetchTokens,
  fetchListings: listingsCached,
  loadSnapshot: snapshotCached,
  findDelegations,
  contractStatus: () => cachedContractStatus().catch(() => null),
  // Jev stays OFF (returns null) until a TYPESAFE_API_KEY exists; the service only calls this once PIXEL_MARKET=live.
  // JEV_DISABLE=1 is a kill switch.
  jevOpinions: async (tokens) => {
    const apiKey = process.env.TYPESAFE_API_KEY?.trim()
    if (!apiKey || process.env.JEV_DISABLE === "1") return null
    return fetchJevOpinions(tokens, { apiKey })
  },
  // Both read the SAME clock the service passes in, so one request can never be half promo, half normal at 16:00 UTC.
  yieldMode: (now) => currentYieldMode(now),
  yieldPinned: (now) => currentYieldPinned(now),
  marketState: currentMarket,
  marketPin,
  now: () => new Date(),
}
