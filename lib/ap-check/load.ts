// AP Check: the I/O half. Every loader is short, never throws, and answers null when it could not find out, so the page can say
// "could not check" instead of showing a wrong number. Nothing here signs, approves or moves anything.

import { parseAbi } from "viem"
import { normalize } from "viem/ens"

import { NORMIES_API_BASE, NORMIES_CANVAS_STORAGE } from "@/constants/contracts"
import { fetchSyncStamps } from "@/lib/burn-buy/data"
import { getSupabase } from "@/lib/db/supabase"
import { publicClient } from "@/lib/viem-client"

import { judgeAp, parseItemOffers, parsePixelSplit, type ApJudgement, type ApReading, type CensusAp, type ItemOffer, type PixelSplit } from "./core"

const STORAGE_ABI = parseAbi(["function attachedOf(uint256 tokenId) view returns (uint256)"])
const OPENSEA = "https://api.opensea.io/api/v2"
const SLUG = "normies"
/** A wallet with more open Normies item offers than this gets the first ones checked and a note saying so. */
export const MAX_WALLET_OFFERS = 300
const MAX_OFFER_PAGES = 3

function within<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p.catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), ms))])
}

/** attachedOf for many tokens in one multicall. A token whose read failed maps to null. */
export async function readAttached(ids: number[], timeoutMs = 6_000): Promise<Map<number, number | null>> {
  const out = new Map<number, number | null>(ids.map((id) => [id, null]))
  if (ids.length === 0) return out
  const res = await within(
    publicClient.multicall({
      allowFailure: true,
      contracts: ids.map((id) => ({ address: NORMIES_CANVAS_STORAGE, abi: STORAGE_ABI, functionName: "attachedOf" as const, args: [BigInt(id)] as const })),
    }),
    timeoutMs,
  )
  if (!res) return out
  res.forEach((r, i) => {
    if (r.status === "success" && typeof r.result === "bigint" && r.result <= BigInt(Number.MAX_SAFE_INTEGER)) out.set(ids[i], Number(r.result))
  })
  return out
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
    Promise.all([db.from("normie_index").select("token_id,action_points,burned").in("token_id", ids), fetchSyncStamps(db)]),
    timeoutMs,
  )
  if (!res) return null
  const [{ data, error }, stamps] = res
  if (error || !data) return null
  const out = new Map<number, CensusAp>()
  for (const row of data as Array<{ token_id: number; action_points: number | null; burned: boolean | null }>) {
    out.set(row.token_id, { ap: row.action_points, burned: row.burned === true, at: stamps.census })
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
  /** Null = could not check OpenSea (no key, or it did not answer). Empty = no open item offers. */
  offers: ItemOffer[] | null
  checkedAt: string
}

/** Everything for one token, fetched in parallel. */
export async function checkToken(tokenId: number): Promise<TokenCheck> {
  const [attached, split, census, offers] = await Promise.all([readAttached([tokenId]), loadSplit(tokenId), loadCensus([tokenId]), loadTokenOffers(tokenId)])
  const reading: ApReading = { tokenId, onchain: attached.get(tokenId) ?? null, split, census: census?.get(tokenId) ?? null }
  return { tokenId, reading, judgement: judgeAp(reading), offers: offers ? offers.offers : null, checkedAt: new Date().toISOString() }
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
