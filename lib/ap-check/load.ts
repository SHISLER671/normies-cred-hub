// AP Check: the I/O half. Every loader is short, never throws, and answers null when it could not find out, so the page can say
// "could not check" instead of showing a wrong number. Nothing here signs, approves or moves anything.

import { parseAbi } from "viem"
import { normalize } from "viem/ens"

import { NORMIES_API_BASE, NORMIES_CANVAS_STORAGE, NORMIES_NFT } from "@/constants/contracts"
import { fetchSyncStamps } from "@/lib/burn-buy/data"
import { loadOpenSeaListings, parseOpenSeaListings } from "@/lib/burn-buy/opensea-listings"
import type { YieldMode } from "@/lib/burn-buy/score"
import { ttl } from "@/lib/burn-buy/ttl"
import { getSupabase } from "@/lib/db/supabase"
import { readAttached } from "@/lib/chain-pixels"
import { publicClient } from "@/lib/viem-client"

import { lensValue, type LensValue } from "./buy-smart"
import { loadBuySmart } from "./buy-smart-load"
import {
  buildApprovalRows,
  isActiveApproval,
  judgeAp,
  judgeListing,
  judgeWithHistory,
  parseArtVersions,
  parsePixelEvents,
  recentArtChange,
  parseItemOffers,
  parsePixelSplit,
  parseShownPixels,
  type ApJudgement,
  type ArtChange,
  type ArtVersion,
  type ApprovalRow,
  type ApReading,
  type CensusAp,
  type ItemOffer,
  type ListingFlag,
  type PixelEvent,
  type PixelSplit,
} from "./core"

const STORAGE_ABI = parseAbi([
  "function attachedOf(uint256 tokenId) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
])
const OPENSEA = "https://api.opensea.io/api/v2"
const SLUG = "normies"
/** A wallet with more open Normies item offers than this gets the first ones checked and a note saying so. */
export const MAX_WALLET_OFFERS = 300
const MAX_OFFER_PAGES = 3

function within<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p.catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), ms))])
}

export { readAttached }

/** Every change to one Normie's attached pixels, newest first. Null when the API could not be read. */
export async function loadPixelHistory(tokenId: number, timeoutMs = 3_000): Promise<PixelEvent[] | null> {
  const res = await within(fetch(`${NORMIES_API_BASE}/canvas/token/${tokenId}/activity?limit=25`, { headers: { Accept: "application/json" }, cache: "no-store" }), timeoutMs)
  if (!res || !res.ok) return null
  return parsePixelEvents(await res.json().catch(() => null))
}

/** Every Canvas transform on one Normie, newest first. Null when the API could not be read. */
export async function loadArtHistory(tokenId: number, timeoutMs = 3_000): Promise<ArtVersion[] | null> {
  const res = await within(fetch(`${NORMIES_API_BASE}/history/normie/${tokenId}/versions?limit=1000`, { headers: { Accept: "application/json" }, cache: "no-store" }), timeoutMs)
  if (!res || !res.ok) return null
  return parseArtVersions(await res.json().catch(() => null))
}

/** Locked / free split from the Normies API (one token). */
export async function loadSplit(tokenId: number, timeoutMs = 3_000): Promise<PixelSplit | null> {
  const res = await within(fetch(`${NORMIES_API_BASE}/canvas/token/${tokenId}/pixels`, { headers: { Accept: "application/json" }, cache: "no-store" }), timeoutMs)
  if (!res || !res.ok) return null
  return parsePixelSplit(await res.json().catch(() => null), tokenId)
}

/** Our census rows for these tokens, plus when the census last refreshed. Null when the database is unavailable. */
export async function loadCensus(ids: number[], timeoutMs = 3_000): Promise<Map<number, CensusAp> | null> {
  const db = getSupabase()
  if (!db || ids.length === 0) return null
  const res = await within(
    Promise.all([db.from("normie_index").select("token_id,action_points,burned,on_pixels").in("token_id", ids), fetchSyncStamps(db)]),
    timeoutMs,
  )
  if (!res) return null
  const [{ data, error }, stamps] = res
  if (error || !data) return null
  const out = new Map<number, CensusAp>()
  for (const row of data as Array<{ token_id: number; action_points: number | null; burned: boolean | null; on_pixels: number | null }>) {
    out.set(row.token_id, { ap: row.action_points, burned: row.burned === true, at: stamps.census, originalPixels: row.on_pixels })
  }
  return out
}

async function openSeaPage(path: string, key: string, timeoutMs: number) {
  const res = await within(fetch(`${OPENSEA}${path}`, { headers: { Accept: "application/json", "X-API-KEY": key }, cache: "no-store" }), timeoutMs)
  if (!res || !res.ok) return null
  return parseItemOffers(await res.json().catch(() => null))
}

/** Open item offers on one Normie (first 50, highest first). Null when OpenSea could not be asked or did not answer. */
export async function loadTokenOffers(tokenId: number, apiKey = process.env.OPENSEA_API_KEY, timeoutMs = 4_000) {
  const key = apiKey?.trim()
  if (!key) return null
  return openSeaPage(`/offers/collection/${SLUG}/nfts/${tokenId}?limit=50`, key, timeoutMs)
}

/** Open Normies offers MADE BY a wallet, following OpenSea's cursor for a few pages. Null when the first page failed. */
export async function loadMakerOffers(address: string, apiKey = process.env.OPENSEA_API_KEY, timeoutMs = 4_000) {
  const key = apiKey?.trim()
  if (!key) return null
  const offers: ItemOffer[] = []
  let criteria = 0
  let cursor: string | null = null
  let complete = true
  for (let page = 0; page < MAX_OFFER_PAGES; page++) {
    const q = `?collection_slugs=${SLUG}&limit=100${cursor ? `&after=${encodeURIComponent(cursor)}` : ""}`
    const parsed = await openSeaPage(`/account/${address}/offers${q}`, key, timeoutMs)
    if (!parsed) {
      if (page === 0) return null
      complete = false
      break
    }
    offers.push(...parsed.offers.filter((o) => o.maker === address.toLowerCase()))
    criteria += parsed.criteria
    cursor = parsed.next
    if (!cursor) break
    if (page === MAX_OFFER_PAGES - 1) complete = false
  }
  offers.sort((a, b) => b.price - a.price || a.tokenId - b.tokenId)
  return { offers, criteria, complete }
}

const ADDRESS = /^0x[0-9a-fA-F]{40}$/

/** A 0x address as-is (lower-cased), or an .eth name resolved on mainnet. Null when it does not resolve. */
export async function resolveWallet(input: string): Promise<{ address: string; ens: string | null } | null> {
  if (ADDRESS.test(input)) return { address: input.toLowerCase(), ens: null }
  try {
    const name = normalize(input)
    const addr = await within(publicClient.getEnsAddress({ name }), 4_000)
    return addr ? { address: addr.toLowerCase(), ens: name } : null
  } catch {
    return null
  }
}

export interface TokenCheck {
  tokenId: number
  reading: ApReading
  judgement: ApJudgement
  /** What OpenSea shows as this Normie's "Action Points" (its cached copy). Null = shows none, or could not ask. */
  shown: number | null
  /** Null = could not check OpenSea (no key, or it did not answer). Empty = no open item offers. */
  offers: ItemOffer[] | null
  /** Changes to its attached pixels, newest first (deposits, withdrawals, burns...). Null = could not read. */
  history: PixelEvent[] | null
  /** Every change to its art, newest first. Null = could not read. Empty = never customized. */
  art: ArtVersion[] | null
  /** The latest art change when it was in the last 3 days (a redraw or a reset); null otherwise. */
  artChange: ArtChange | null
  /** The cheapest OpenSea listing for this Normie right now, in ETH. Null = not listed, or could not ask. */
  listingPriceEth: number | null
  /** The lens: what burning it would pay with its LIVE pixels, and what those pixels cost on the Pixel Market. */
  lens: LensValue | null
  yieldMode: YieldMode | null
  bestAskEth: number | null
  checkedAt: string
}

/** The cheapest active OpenSea listing for one Normie (ETH). Null when it is not listed or OpenSea could not be asked. */
export async function loadListingPrice(tokenId: number, apiKey = process.env.OPENSEA_API_KEY, timeoutMs = 4_000): Promise<number | null> {
  const key = apiKey?.trim()
  if (!key) return null
  const res = await within(
    fetch(`${OPENSEA}/listings/collection/${SLUG}/nfts/${tokenId}/best`, { headers: { Accept: "application/json", "X-API-KEY": key }, cache: "no-store" }),
    timeoutMs,
  )
  if (!res || !res.ok) return null
  const body = await res.json().catch(() => null)
  // The best-listing endpoint returns one Listing; the strict listings parser checks it exactly like a page of them.
  const parsed = parseOpenSeaListings({ listings: body ? [body] : [] })
  return parsed?.listings.find((l) => l.tokenId === tokenId)?.priceEth ?? null
}

/** Everything for one token, fetched in parallel. */
export async function checkToken(tokenId: number): Promise<TokenCheck> {
  const [attached, split, census, offers, shown, price, market, history, art] = await Promise.all([
    readAttached([tokenId]),
    loadSplit(tokenId),
    loadCensus([tokenId]),
    loadTokenOffers(tokenId),
    loadShownPixels([tokenId]),
    loadListingPrice(tokenId),
    loadBuySmart(),
    loadPixelHistory(tokenId),
    loadArtHistory(tokenId),
  ])
  const reading: ApReading = { tokenId, onchain: attached.get(tokenId) ?? null, split, census: census?.get(tokenId) ?? null }
  const original = reading.census?.originalPixels
  const bestAsk = market?.book && !market.book.paused ? market.book.bestAskEth : null
  const lens =
    reading.onchain !== null && typeof original === "number" && market && !reading.census?.burned
      ? lensValue(original, reading.onchain, market.yieldMode, price, bestAsk)
      : null
  return {
    tokenId,
    reading,
    judgement: judgeWithHistory(judgeAp(reading), reading, history),
    shown: shown?.get(tokenId) ?? null,
    offers: offers ? offers.offers : null,
    listingPriceEth: price,
    history,
    art,
    artChange: recentArtChange(art),
    lens,
    yieldMode: market?.yieldMode ?? null,
    bestAskEth: bestAsk,
    checkedAt: new Date().toISOString(),
  }
}

export interface CheckedOffer extends ItemOffer {
  onchain: number | null
  judgement: ApJudgement
}

export type WalletCheck =
  | { kind: "ok"; address: string; ens: string | null; offers: CheckedOffer[]; atRisk: number; criteria: number; complete: boolean; checkedAt: string }
  | { kind: "error"; message: string }

/** Every open Normies item offer a wallet has made, each next to its Normie's live AP. */
export async function checkWallet(input: string): Promise<WalletCheck> {
  const who = await resolveWallet(input)
  if (!who) return { kind: "error", message: "That name does not resolve to a wallet. Paste the 0x address instead." }
  const made = await loadMakerOffers(who.address)
  if (!made) return { kind: "error", message: "Could not reach OpenSea to list this wallet's offers. Try again in a minute." }
  const capped = made.offers.slice(0, MAX_WALLET_OFFERS)
  const ids = [...new Set(capped.map((o) => o.tokenId))]
  const [attached, census] = await Promise.all([readAttached(ids), loadCensus(ids)])
  const offers: CheckedOffer[] = capped.map((o) => {
    const reading: ApReading = { tokenId: o.tokenId, onchain: attached.get(o.tokenId) ?? null, split: null, census: census?.get(o.tokenId) ?? null }
    return { ...o, onchain: reading.onchain, judgement: judgeAp(reading) }
  })
  // Risky first (the ones to look at), then by price.
  offers.sort((a, b) => Number(b.judgement.offerRisk) - Number(a.judgement.offerRisk) || b.price - a.price)
  return {
    kind: "ok",
    address: who.address,
    ens: who.ens,
    offers,
    atRisk: offers.filter((o) => o.judgement.offerRisk).length,
    criteria: made.criteria,
    complete: made.complete && made.offers.length <= MAX_WALLET_OFFERS,
    checkedAt: new Date().toISOString(),
  }
}

/** OpenSea's batch NFT lookup takes a list of identifiers; we send small chunks so one bad chunk does not sink the rest. */
const SHOWN_CHUNK = 25

/** What OpenSea SHOWS as "Action Points" for these Normies. Null when no chunk could be read (no key, or OpenSea is down). */
export async function loadShownPixels(ids: number[], apiKey = process.env.OPENSEA_API_KEY, timeoutMs = 4_000): Promise<Map<number, number | null> | null> {
  const key = apiKey?.trim()
  if (!key || ids.length === 0) return null
  const chunks: number[][] = []
  for (let i = 0; i < ids.length; i += SHOWN_CHUNK) chunks.push(ids.slice(i, i + SHOWN_CHUNK))
  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const body = JSON.stringify({ identifiers: chunk.map((id) => ({ chain: "ethereum", contract_address: NORMIES_NFT, token_id: String(id) })) })
      const res = await within(
        fetch(`${OPENSEA}/nfts/batch`, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json", "X-API-KEY": key }, body, cache: "no-store" }),
        timeoutMs,
      )
      if (!res || !res.ok) return null
      return parseShownPixels(await res.json().catch(() => null))
    }),
  )
  if (results.every((r) => r === null)) return null
  const out = new Map<number, number | null>()
  for (const r of results) if (r) for (const [id, v] of r) out.set(id, v)
  return out
}

/** How many of the cheapest listings are checked. */
export const LISTINGS_CHECKED = 100

export interface ListingRow {
  tokenId: number
  priceEth: number
  live: number | null
  shown: number | null
}

/** How many of the cheapest listings are shown in full, flagged or not. */
export const LISTINGS_SHOWN = 10

export type ListingsCheck =
  | {
      kind: "ok"
      /** Listings compared. */
      checked: number
      flags: ListingFlag[]
      /** False when OpenSea's shown values could not be read, so only the census comparison ran. */
      shownChecked: boolean
      /** How many of the checked listings OpenSea showed a pixel number for (0 with shownChecked = the trait was not found). */
      shownCount: number
      /** The cheapest few, flagged or not, so people can see what was compared. */
      cheapest: ListingRow[]
      censusAt: string | null
      checkedAt: string
    }
  | { kind: "error"; message: string }

async function runListingsCheck(): Promise<Extract<ListingsCheck, { kind: "ok" }>> {
  const listings = await loadOpenSeaListings(process.env.OPENSEA_API_KEY)
  if (!listings) throw new Error("listings unavailable") // thrown, not returned, so the shared cache never keeps a failure
  const top = listings.slice(0, LISTINGS_CHECKED)
  const ids = top.map((l) => l.tokenId)
  const [live, census, shown] = await Promise.all([readAttached(ids), loadCensus(ids), loadShownPixels(ids)])
  const flags: ListingFlag[] = []
  const rows: ListingRow[] = []
  let censusAt: string | null = null
  let shownCount = 0
  for (const l of top) {
    const c = census?.get(l.tokenId) ?? null
    if (c?.at) censusAt = c.at
    const row: ListingRow = { tokenId: l.tokenId, priceEth: l.priceEth, live: live.get(l.tokenId) ?? null, shown: shown?.get(l.tokenId) ?? null }
    if (row.shown !== null) shownCount++
    rows.push(row)
    const f = judgeListing({ ...row, census: c })
    if (f) flags.push(f)
  }
  flags.sort((a, b) => a.priceEth - b.priceEth || a.tokenId - b.tokenId)
  rows.sort((a, b) => a.priceEth - b.priceEth || a.tokenId - b.tokenId)
  return {
    kind: "ok",
    checked: top.length,
    flags,
    shownChecked: shown !== null,
    shownCount,
    cheapest: rows.slice(0, LISTINGS_SHOWN),
    censusAt,
    checkedAt: new Date().toISOString(),
  }
}

/** The listings check is the same for everyone, so it is shared for a minute: at most a handful of OpenSea calls a minute. */
const listingsCached = ttl(60_000, runListingsCheck)

export async function checkListings(): Promise<ListingsCheck> {
  try {
    return await listingsCached()
  } catch {
    return { kind: "error", message: "Could not read OpenSea listings just now. Try again in a minute." }
  }
}

export type ApprovalsCheck =
  | {
      kind: "ok"
      address: string
      ens: string | null
      /** Pixels in the wallet itself (not counting pixels attached to Normies). Null = read failed. */
      walletPixels: number | null
      rows: ApprovalRow[]
      active: number
      activeUnofficial: number
      /** Up to which block the approvals index is complete, and when it last caught up. */
      indexedThrough: number | null
      indexedAt: string | null
      checkedAt: string
    }
  | { kind: "error"; message: string }

/** Every spender this wallet has approved for #PIXEL (from our index), each with its live allowance from the chain. */
export async function checkApprovals(input: string): Promise<ApprovalsCheck> {
  const who = await resolveWallet(input)
  if (!who) return { kind: "error", message: "That name does not resolve to a wallet. Paste the 0x address instead." }
  const db = getSupabase()
  if (!db) return { kind: "error", message: "The approvals index is not reachable just now. Try again in a minute." }
  const res = await within(
    Promise.all([
      db.from("pixel_approvals").select("spender,amount").eq("owner", who.address),
      db.from("census_sync").select("synced_at,summary").eq("job", "approvals").maybeSingle(),
    ]),
    4_000,
  )
  if (!res) return { kind: "error", message: "The approvals index is not reachable just now. Try again in a minute." }
  const [{ data: rows, error }, { data: sync }] = res
  if (error) return { kind: "error", message: "The approvals index is not reachable just now. Try again in a minute." }
  const stored = ((rows ?? []) as Array<{ spender: string; amount: string | number }>).map((r) => ({ spender: r.spender, amount: String(r.amount) }))

  const owner = who.address as `0x${string}`
  // Two separate reads, each with one function, the same shape as readAttached (which builds and runs).
  const [allowances, balance] = await Promise.all([
    stored.length === 0
      ? Promise.resolve(null)
      : within(
          publicClient.multicall({
            allowFailure: true,
            contracts: stored.map((s) => ({
              address: NORMIES_CANVAS_STORAGE,
              abi: STORAGE_ABI,
              functionName: "allowance" as const,
              args: [owner, s.spender as `0x${string}`] as const,
            })),
          }),
          6_000,
        ),
    within(publicClient.readContract({ address: NORMIES_CANVAS_STORAGE, abi: STORAGE_ABI, functionName: "balanceOf", args: [owner] }), 4_000),
  ])
  const live = new Map<string, string | null>()
  stored.forEach((s, i) => {
    const r = allowances ? allowances[i] : undefined
    live.set(s.spender.toLowerCase(), r && r.status === "success" && typeof r.result === "bigint" ? r.result.toString() : null)
  })
  const walletPixels = typeof balance === "bigint" && balance <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(balance) : null

  const built = buildApprovalRows(stored, live)
  const active = built.filter(isActiveApproval)
  const summary = (sync?.summary ?? {}) as { lastBlock?: number }
  return {
    kind: "ok",
    address: who.address,
    ens: who.ens,
    walletPixels,
    rows: built,
    active: active.length,
    activeUnofficial: active.filter((r) => !r.official).length,
    indexedThrough: typeof summary.lastBlock === "number" ? summary.lastBlock : null,
    indexedAt: (sync as { synced_at?: string } | null)?.synced_at ?? null,
    checkedAt: new Date().toISOString(),
  }
}
