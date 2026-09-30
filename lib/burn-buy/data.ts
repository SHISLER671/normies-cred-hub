// Real data sources for the burn/buy answer. Kept thin on purpose: all decisions live in the tested pure modules.
// Upstream limit: api.normies.art allows 60 requests/min per IP, so everything here is cached
// (Next data cache plus a short in-process cache) and listings are shared across visitors.

import { NORMIES_API_BASE } from "@/constants/contracts"
import { getSupabase } from "@/lib/db/supabase"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"

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

const listingsCached = ttl(60_000, async () => {
  const items: RawListing[] = []
  let total = 0
  let floorEth: number | null = null
  for (let page = 1; page <= 8; page++) {
    const d = await getJson<{ items?: RawItem[]; total?: number; totalPages?: number; floorPrice?: number }>(
      `${RARITY}/normies?listed=1&limit=100&page=${page}&sort=price&order=asc`,
      "listings",
      60,
    )
    if (page === 1) { total = d.total ?? 0; floorEth = num(d.floorPrice) }
    for (const it of d.items ?? []) {
      const price = num(it.listing?.priceEth)
      if (price && price > 0) items.push({ ...toToken(it), priceEth: price, url: it.listing?.url })
    }
    if (page >= (d.totalPages ?? 1)) break
  }
  return { items, floorEth, total }
})

/** Every living token's original pixels, plus the census. Reads the public, read-only normie_index. */
const snapshotCached = ttl(10 * 60_000, async (): Promise<MarketSnapshot> => {
  const db = getSupabase()
  if (!db) throw new Error("database is not configured")
  const originalPixels = new Map<number, number>()
  const pixelSupply = new Map<number, number>()
  const wallets = new Map<string, { n: number; ap: number }>()
  let oldest: string | null = null
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("normie_index")
      .select("token_id,owner,action_points,on_pixels,indexed_at")
      .eq("burned", false)
      .order("token_id")
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    for (const r of data ?? []) {
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
    if ((data?.length ?? 0) < 1000) break
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
})

export const realDeps: Deps = {
  resolveHolder,
  fetchTokens,
  fetchListings: listingsCached,
  loadSnapshot: snapshotCached,
  now: () => new Date(),
}
