// Orchestrates one burn/buy answer. It fetches NOTHING itself: every data source is passed in (`Deps`),
// so every success and failure path can be tested with fakes. Rule: no silent fallbacks. If a source fails,
// the response says so, per source, instead of quietly guessing.

import { walletScore } from "./score"
import {
  adviseWallet,
  ARTICLE_WINDOW,
  historicalPayoutEth,
  rankFodder,
  type FodderPick,
  type HeldToken,
  type Listing,
  type WalletAdvice,
} from "./advise"

export type SourceName = "holder" | "rarity" | "listings" | "index"

export class SourceError extends Error {
  constructor(
    public source: SourceName,
    message: string,
    public kind: "invalid-input" | "upstream" = "upstream",
  ) {
    super(message)
    this.name = "SourceError"
  }
}

export interface RarityToken {
  id: number
  rank: number | null
  type: string | null
  actionPoints: number
  awakenedAgent: boolean
  fairValueEth: number | null
}

export interface RawListing extends RarityToken {
  priceEth: number
  url?: string
}

export interface MarketSnapshot {
  livingSupply: number
  wallets: number
  censusTotal: number
  /** Original pixel count per living token id. */
  originalPixels: Map<number, number>
  /** How many living tokens share each original pixel count. */
  pixelSupply: Map<number, number>
  /** Age of the index data. */
  oldestIndexedAt: string | null
  /** Each owner's score as computed from the index (lower-case address), to keep the census consistent. */
  walletScores: Map<string, number>
}

export interface Deps {
  resolveHolder(input: string): Promise<{ address: string; ens: string | null; tokenIds: number[] }>
  fetchTokens(ids: number[]): Promise<RarityToken[]>
  fetchListings(): Promise<{ items: RawListing[]; floorEth: number | null; total: number }>
  loadSnapshot(): Promise<MarketSnapshot>
  now(): Date
}

export interface SourceStatus {
  ok: boolean
  error?: string
  note?: string
}

export interface BurnBuyResult {
  asOf: string
  promo: { ratePercent: number; basis: string; ends: string }
  wallet: null | {
    address: string
    ens: string | null
    advice: WalletAdvice & { holdings: Array<{ tokenId: number; originalPixels: number; actionPoints: number; rank: number | null; type: string | null }> }
    historicalIllustration: { payoutEthIfSharePaidLikeArticleWindow: number; source: string }
  }
  market: null | {
    floorEth: number | null
    listedCount: number
    bestPixelFodder: FodderPick[]
    bestApCarriers: FodderPick[]
    skippedListings: number
  }
  census: { wallets: number; totalScore: number; livingSupply: number; indexOldestIndexedAt: string | null }
  sources: Record<SourceName, SourceStatus>
  caveats: string[]
}

export const PROMO_INFO = {
  ratePercent: 4,
  basis: "4% of the burned Normie's original (base) pixel count, plus the burned token's own AP",
  ends: "Pixel Market launch, planned for October 5 (audits permitting); not guaranteed",
} as const

/** Largest holder today has 432. Above this we refuse rather than show a wrong (truncated) score. */
const MAX_TOKENS = 1000

function fail(source: SourceName, e: unknown): SourceStatus {
  return { ok: false, error: e instanceof Error ? e.message : String(e) }
}

export async function buildBurnBuy(input: { wallet?: string }, deps: Deps): Promise<BurnBuyResult> {
  const sources: BurnBuyResult["sources"] = {
    holder: { ok: true, note: "not requested" },
    rarity: { ok: true, note: "not requested" },
    listings: { ok: true },
    index: { ok: true },
  }
  const caveats: string[] = [
    "Burns are permanent. Verify on normies.art before you burn; this page cannot see the chain in real time.",
    "Not financial advice. #PIXEL has no market price yet, so moves are compared by score, not value.",
    "Yield uses each token's ORIGINAL pixel count (what the contract pays on), not its current edited art.",
  ]

  // The index snapshot is mandatory: without original pixels and the census nothing can be computed honestly.
  let snap: MarketSnapshot
  try {
    snap = await deps.loadSnapshot()
    sources.index = { ok: true, note: snap.oldestIndexedAt ? `oldest row indexed ${snap.oldestIndexedAt}` : undefined }
  } catch (e) {
    throw new SourceError("index", `index unavailable: ${e instanceof Error ? e.message : e}`)
  }
  const ctx = { livingSupply: snap.livingSupply, censusTotal: snap.censusTotal }
  if (snap.oldestIndexedAt) {
    caveats.push(`The census and original pixel counts come from an index whose oldest row is from ${snap.oldestIndexedAt.slice(0, 16).replace("T", " ")} UTC; ownership may have changed since. Your own tokens are read live.`)
  }

  // Market listings: optional. If it fails we say so and still answer the wallet question.
  let listings: Listing[] = []
  let market: BurnBuyResult["market"] = null
  try {
    const raw = await deps.fetchListings()
    let skipped = 0
    for (const r of raw.items) {
      const px = snap.originalPixels.get(r.id)
      if (px === undefined) { skipped++; continue }
      listings.push({
        tokenId: r.id,
        priceEth: r.priceEth,
        actionPoints: r.actionPoints,
        originalPixels: px,
        rank: r.rank,
        type: r.type,
        awakenedAgent: r.awakenedAgent,
        pixelSupply: snap.pixelSupply.get(px) ?? 0,
        url: r.url,
      })
    }
    market = {
      floorEth: raw.floorEth,
      listedCount: raw.total,
      bestPixelFodder: rankFodder(listings, ctx, { withAp: false, limit: 10 }),
      bestApCarriers: rankFodder(listings, ctx, { withAp: true, limit: 10 }),
      skippedListings: skipped,
    }
    if (skipped > 0) sources.listings = { ok: true, note: `${skipped} listings skipped: not in the index yet` }
  } catch (e) {
    sources.listings = fail("listings", e)
    listings = []
  }

  // Wallet: optional.
  let wallet: BurnBuyResult["wallet"] = null
  if (input.wallet) {
    let holder: { address: string; ens: string | null; tokenIds: number[] }
    try {
      holder = await deps.resolveHolder(input.wallet)
      sources.holder = { ok: true }
    } catch (e) {
      if (e instanceof SourceError) throw e
      throw new SourceError("holder", `could not look up that wallet: ${e instanceof Error ? e.message : e}`)
    }
    if (holder.tokenIds.length > MAX_TOKENS) {
      throw new SourceError("holder", `This wallet holds more than ${MAX_TOKENS} Normies; that is too many to analyse here.`, "invalid-input")
    }
    const ids = holder.tokenIds
    let tokens: RarityToken[] = []
    if (ids.length) {
      try {
        tokens = await deps.fetchTokens(ids)
        sources.rarity = { ok: true }
      } catch (e) {
        throw new SourceError("rarity", `could not load token details: ${e instanceof Error ? e.message : e}`)
      }
    } else {
      sources.rarity = { ok: true, note: "wallet holds no Normies" }
    }

    const floor = market?.floorEth ?? 0
    const held: HeldToken[] = []
    for (const t of tokens) {
      const px = snap.originalPixels.get(t.id)
      if (px === undefined) { caveats.push(`#${t.id} is not in the index yet and was skipped.`); continue }
      held.push({
        tokenId: t.id,
        originalPixels: px,
        actionPoints: t.actionPoints,
        rank: t.rank,
        type: t.type,
        awakenedAgent: t.awakenedAgent,
        pixelSupply: snap.pixelSupply.get(px) ?? 0,
        forgoneValueEth: t.fairValueEth ?? floor,
      })
    }
    const own = new Set(held.map((h) => h.tokenId))
    // The census was built from the index; this wallet's holdings are live. Swap its index score for its live
    // score so 'everyone else' is exactly the census minus this wallet, and its share is computed consistently.
    const liveScore = walletScore(held.length, held.reduce((sum, h) => sum + h.actionPoints, 0))
    const indexScore = snap.walletScores.get(holder.address.toLowerCase()) ?? 0
    const walletCtx = { ...ctx, censusTotal: Math.max(0, snap.censusTotal - indexScore) + liveScore }
    const advice = adviseWallet(held, listings.filter((l) => !own.has(l.tokenId)), walletCtx)
    if (held.length === 0) {
      advice.notes.push("If you typed an ENS name, it may point to a different wallet than the one that holds your Normie.")
    }
    wallet = {
      address: holder.address,
      ens: holder.ens,
      advice: {
        ...advice,
        holdings: held.map((h) => ({ tokenId: h.tokenId, originalPixels: h.originalPixels, actionPoints: h.actionPoints, rank: h.rank, type: h.type })),
      },
      historicalIllustration: {
        payoutEthIfSharePaidLikeArticleWindow: historicalPayoutEth(advice.sharePct),
        source: ARTICLE_WINDOW.source,
      },
    }
  }

  return {
    asOf: deps.now().toISOString(),
    promo: { ...PROMO_INFO },
    wallet,
    market,
    census: {
      wallets: snap.wallets,
      totalScore: Math.round(snap.censusTotal * 10) / 10,
      livingSupply: snap.livingSupply,
      indexOldestIndexedAt: snap.oldestIndexedAt,
    },
    sources,
    caveats,
  }
}
