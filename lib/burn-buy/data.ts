// Real data sources for the burn/buy answer. Kept thin on purpose: all decisions live in the tested pure modules.
// Upstream limit: api.normies.art allows 60 requests/min per IP, so everything here is cached
// (Next data cache plus a short in-process cache) and listings are shared across visitors.

import { NORMIES_API_BASE } from "@/constants/contracts"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getSupabase } from "@/lib/db/supabase"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"

import { fetchJevOpinions } from "./jev"
import { currentMarket, currentYieldMode, currentYieldPinned } from "./switches"
import { walletScore } from "./score"
import { SourceError, type Deps, type MarketSnapshot, type RarityToken, type RawListing } from "./service"

const RARITY = `${NORMIES_API_BASE}/rarity`
const HEADERS = { Accept: "application/json" }

/** Tiny TTL cache that also shares one in-flight load between concurrent callers. */
function ttl<T>(ms: number, load: () => Promise<T>): () => Promise<T> {
  let value: T | undefined
  let at = 0
  let inflight: Promise<T> | null = null
  return async () => {
    if (value !== undefined && Date.now() - at < ms) return value
    if (!inflight) {
      inflight = load()
        .then((v) => { value = v; at = Date.now(); return v })
        .finally(() => { inflight = null })
    }
    return inflight
  }
}

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
    res = await fetchWithTimeout(url, { headers: HEADERS, next: { revalidate } }, 10_000)
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

const listingsCached = ttl(60_000, () =>
  loadListings((page) =>
    getJson<ListingsPage>(`${RARITY}/normies?listed=1&limit=100&page=${page}&sort=price&order=asc`, "listings", 60),
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

/** Pure: turns index rows into the snapshot the advice needs. */
export function snapshotFromRows(rows: IndexRow[]): MarketSnapshot {
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
  return { livingSupply: originalPixels.size, wallets: wallets.size, censusTotal, originalPixels, pixelSupply, oldestIndexedAt: oldest, walletScores }
}

/** Every living token's original pixels, plus the census. Reads the public, read-only normie_index. */
const snapshotCached = ttl(10 * 60_000, async (): Promise<MarketSnapshot> => {
  const db = getSupabase()
  if (!db) throw new Error("database is not configured")
  return snapshotFromRows(await fetchIndexRows(db))
})

/** Tokens for which `address` is the Canvas delegate, from the index. Only ever called with a validated 0x address. */
async function findDelegations(address: string): Promise<Array<{ tokenId: number; owner: string }>> {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return []
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

export const realDeps: Deps = {

  resolveHolder,
  fetchTokens,
  fetchListings: listingsCached,
  loadSnapshot: snapshotCached,
  findDelegations,
  // Jev stays OFF (returns null) until a TYPESAFE_API_KEY exists; the service only calls this once PIXEL_MARKET=live.
  // JEV_DISABLE=1 is a kill switch.
  jevOpinions: async (tokens) => {
    const apiKey = process.env.TYPESAFE_API_KEY?.trim()
    if (!apiKey || process.env.JEV_DISABLE === "1") return null
    return fetchJevOpinions(tokens, { apiKey })
  },
  yieldMode: () => currentYieldMode(),
  yieldPinned: () => currentYieldPinned(),
  marketState: currentMarket,
  now: () => new Date(),
}
