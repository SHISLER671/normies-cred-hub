// A fallback source for the Normies listings, used only when the Normies API's own listings come back empty or fail.
// Live 2026-10-05: api.normies.art `/rarity/normies?listed=1` answered total 0 and floorPrice null for hours while OpenSea held 100+ listings,
// which removed the fodder table, the buy moves and the floor from /burn and Ask.
//
// OpenSea API v2, "best listings for a collection": GET /api/v2/listings/collection/normies/best?limit=100 (X-API-KEY). Seen live 2026-10-05:
// ETH prices (18 decimals), sorted cheapest first, only ACTIVE, the same token can appear in more than one listing (we keep its cheapest),
// and a `next` cursor for the following page. The cheapest of those is the collection floor.

import { NORMIES_NFT } from "@/constants/contracts"

const ENDPOINT = "https://api.opensea.io/api/v2/listings/collection/normies/best"
const PAGE_LIMIT = 100
/** Pages of 100 followed through `next`. Three is the cheapest ~250 tokens: plenty for fodder, and at most three OpenSea calls per minute (60 s cache). */
export const MAX_PAGES = 3

export interface OpenSeaListing {
  tokenId: number
  priceEth: number
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object"

/**
 * Strict: only ACTIVE listings in ETH (18 decimals) for the Normies contract, one per token (its cheapest), cheapest first.
 * Anything else is dropped, and a body that is not the documented shape is null, so a changed API can never invent a price.
 */
export function parseOpenSeaListings(raw: unknown, contract: string = NORMIES_NFT): { listings: OpenSeaListing[]; next: string | null } | null {
  if (!isObj(raw) || !Array.isArray(raw.listings)) return null
  const want = contract.toLowerCase()
  const cheapest = new Map<number, number>()
  for (const l of raw.listings) {
    if (!isObj(l) || l.status !== "ACTIVE") continue
    const asset = l.asset
    const cur = isObj(l.price) && isObj(l.price.current) ? l.price.current : null
    if (!isObj(asset) || !cur) continue
    if (typeof asset.contract !== "string" || asset.contract.toLowerCase() !== want) continue
    if (cur.currency !== "ETH" || cur.decimals !== 18 || typeof cur.value !== "string" || !/^\d+$/.test(cur.value)) continue
    const id = Number(asset.identifier)
    if (!Number.isInteger(id) || id < 0 || id > 9999) continue
    const eth = Number(BigInt(cur.value)) / 1e18
    if (!(eth > 0)) continue
    const have = cheapest.get(id)
    if (have === undefined || eth < have) cheapest.set(id, eth)
  }
  const listings = [...cheapest.entries()].map(([tokenId, priceEth]) => ({ tokenId, priceEth })).sort((a, b) => a.priceEth - b.priceEth || a.tokenId - b.tokenId)
  return { listings, next: typeof raw.next === "string" && raw.next ? raw.next : null }
}

/** Follows the `next` cursor up to MAX_PAGES. Never throws: any problem is null, and an empty collection is an empty list. */
export async function loadOpenSeaListings(apiKey: string | undefined, fetchImpl: typeof fetch = fetch, timeoutMs = 4_000): Promise<OpenSeaListing[] | null> {
  const key = apiKey?.trim()
  if (!key) return null
  try {
    const cheapest = new Map<number, number>()
    let cursor: string | null = null
    for (let page = 0; page < MAX_PAGES; page++) {
      const url = `${ENDPOINT}?limit=${PAGE_LIMIT}${cursor ? `&next=${encodeURIComponent(cursor)}` : ""}`
      const res: Response = await fetchImpl(url, { headers: { Accept: "application/json", "X-API-KEY": key }, signal: AbortSignal.timeout(timeoutMs) })
      if (!res.ok) return page === 0 ? null : [...mapToList(cheapest)]
      const parsed = parseOpenSeaListings(await res.json())
      if (!parsed) return page === 0 ? null : [...mapToList(cheapest)]
      for (const l of parsed.listings) {
        const have = cheapest.get(l.tokenId)
        if (have === undefined || l.priceEth < have) cheapest.set(l.tokenId, l.priceEth)
      }
      cursor = parsed.next
      if (!cursor) break
    }
    return mapToList(cheapest)
  } catch {
    return null
  }
}

const mapToList = (m: Map<number, number>): OpenSeaListing[] =>
  [...m.entries()].map(([tokenId, priceEth]) => ({ tokenId, priceEth })).sort((a, b) => a.priceEth - b.priceEth || a.tokenId - b.tokenId)

export const openSeaAssetUrl = (tokenId: number): string => `https://opensea.io/item/ethereum/${NORMIES_NFT.toLowerCase()}/${tokenId}`
