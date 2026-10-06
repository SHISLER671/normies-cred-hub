// Buy smart: the I/O half. Gathers the live inputs once a minute (shared by everyone: no per-visitor cost) and hands them to the pure
// calculator in ./buy-smart. Never throws; a missing source shows as "could not price" rather than a wrong answer.

import type { YieldMode } from "@/lib/burn-buy/score"
import type { PixelMarketSnapshot } from "@/lib/burn-buy/market-math"
import { realDeps } from "@/lib/burn-buy/data"
import { buildBurnBuy } from "@/lib/burn-buy/service"
import { ttl } from "@/lib/burn-buy/ttl"

import { burnPicks, type BurnCandidate, type BurnPick } from "./buy-smart"

export interface BuySmartInputs {
  yieldMode: YieldMode
  /** Who set the burn mode: the Normies contract itself (checked live), the site owner's pin, or the clock. */
  modeSource: "pinned" | "contract" | "clock"
  book: PixelMarketSnapshot | null
  /** Every listed Normie with a known original pixel count, priced as a burn with LIVE chain pixels, cheapest per pixel first. */
  picks: BurnPick[]
  /** Listings looked at, and how many had their pixels confirmed on the chain. */
  listingsChecked: number
  liveConfirmed: number
  asOf: string
}

async function load(): Promise<BuySmartInputs> {
  const [base, listings, snapshot] = await Promise.all([buildBurnBuy({}, realDeps), realDeps.fetchListings(), realDeps.loadSnapshot()])
  const cands: BurnCandidate[] = []
  for (const it of listings.items) {
    const original = snapshot.originalPixels.get(it.id)
    if (original === undefined) continue
    cands.push({ tokenId: it.id, priceEth: it.priceEth, originalPixels: original, livePixels: it.actionPoints, customized: it.customized })
  }
  const checked = (listings as { liveApChecked?: number }).liveApChecked ?? 0
  return {
    yieldMode: base.yieldMode,
    modeSource: base.promo.source,
    book: base.pixelMarket,
    picks: burnPicks(cands, base.yieldMode),
    listingsChecked: listings.items.length,
    liveConfirmed: checked,
    asOf: new Date().toISOString(),
  }
}

const cached = ttl(60_000, load)

export async function loadBuySmart(): Promise<BuySmartInputs | null> {
  try {
    return await cached()
  } catch {
    return null
  }
}
