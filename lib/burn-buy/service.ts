// Orchestrates one burn/buy answer. It fetches NOTHING itself: every data source is passed in (`Deps`),
// so every success and failure path can be tested with fakes. Rule: no silent fallbacks. If a source fails,
// the response says so, per source, instead of quietly guessing.

import { type YieldMode, type MarketState, walletScore } from "./score"
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
import { promoWindow, type PromoWindow } from "./promo-window"
import { JEV_MAX_TOKENS, type JevOpinion, type JevToken } from "./jev"

export type SourceName = "holder" | "rarity" | "listings" | "index" | "jev"

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
  /** All the Normie's traits as the rarity API lists them (Type, Gender, Age, Hair Style, ...). Optional. */
  traits?: Record<string, string | number>
  /** True when the owner has edited the art (burning it would erase that art). Optional. */
  customized?: boolean
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
  /** Tokens this address is the Canvas delegate for (it can edit pixels but cannot burn). Optional. */
  findDelegations?(address: string): Promise<Array<{ tokenId: number; owner: string }>>
  /** Jev's second opinion on burn candidates. Optional. Returns null when Jev is off (no key / kill switch). Only called when the market is live. */
  jevOpinions?(tokens: JevToken[]): Promise<{ opinions: Record<number, JevOpinion> } | null>
  /** How a burn pays. Optional; missing means "promo" (today). Real deps read BURN_YIELD_MODE. */
  yieldMode?(): YieldMode
  /** True when the site owner pinned the yield mode (BURN_YIELD_MODE) instead of letting the clock decide. Optional; missing means false. */
  yieldPinned?(): boolean
  /** Whether Pixel Market is open. Optional; missing means "pending" (today). Real deps read PIXEL_MARKET. */
  marketState?(): MarketState
  now(): Date
}

export interface SourceStatus {
  ok: boolean
  error?: string
  note?: string
}

export interface BurnBuyResult {
  asOf: string
  /** How a burn pays: the fixed 4% "promo" (until Monday) or a "normal" roll inside a tier range. */
  yieldMode: YieldMode
  /** Whether Pixel Market (the #PIXEL exchange) is open. */
  marketState: MarketState
  /** In normal mode `ratePercent` is null: the rate is a roll inside a tier range, described in `basis`. */
  promo: { ratePercent: number | null; basis: string; ends: string; window: PromoWindow }
  wallet: null | {
    address: string
    ens: string | null
    /** Set when the wallet owns nothing but is a Canvas delegate: burn advice needs the owner wallet. */
    delegateOf: Array<{ tokenId: number; owner: string }>
    advice: WalletAdvice & { holdings: Array<{ tokenId: number; originalPixels: number; actionPoints: number; rank: number | null; type: string | null }> }
    historicalIllustration: { payoutEthIfSharePaidLikeArticleWindow: number; source: string }
    /** Jev's second opinion per burn candidate (only when the market is live and Jev is on). It never changes a verdict. */
    jev?: Record<number, JevOpinion>
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

export const NORMAL_INFO = {
  ratePercent: null,
  basis: "a roll inside a range set by the burned Normie's original pixel count (0-490 px 1-4%, 491-890 px 2-4%, 891+ px 3-4%, per the Sep 23 article), plus the burned token's own AP",
  ends: "The fixed 4% promo has ended; burns are back to the normal rolls",
} as const

export const PROMO_INFO = {
  ratePercent: 4,
  basis: "4% of the burned Normie's original (base) pixel count, plus the burned token's own AP",
  ends: "Until 8 PM Central European time on Monday, October 5 (18:00 UTC), and possibly closed 1 to 2 hours earlier, per Serc in the community chat (not independently verified, so not guaranteed); burns then return to the normal 1-4% range",
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
    jev: { ok: true, note: "off" },
  }
  const yieldMode: YieldMode = deps.yieldMode ? deps.yieldMode() : "promo"
  const marketState: MarketState = deps.marketState ? deps.marketState() : "pending"
  const caveats: string[] = [
    "Burns are permanent. Verify on normies.art before you burn; this page cannot see the chain in real time.",
    marketState === "live"
      ? "Not financial advice. This tool does not read live #PIXEL prices yet, so moves are compared by score, not value."
      : "Not financial advice. #PIXEL has no market price yet, so moves are compared by score, not value.",
    "Yield uses each token's ORIGINAL pixel count (what the contract pays on), not its current edited art.",
    ...(yieldMode === "normal"
      ? ["A burn is now a roll inside a range, so figures here are the middle of the range with the full range beside them. Real burns can land anywhere in it. The tiers come from the Sep 23 @normiesART article."]
      : []),
  ]

  // Start the three independent lookups together (cold, they used to run one after another: about 7 s). They are awaited
  // below in the ORIGINAL order, so which error wins when several fail is unchanged. The no-op catches only stop a
  // rejected promise from being reported as unhandled before it is awaited; the real handling is below.
  const snapshotP = deps.loadSnapshot()
  const listingsP = deps.fetchListings()
  const holderP = input.wallet ? deps.resolveHolder(input.wallet) : null
  for (const p of [snapshotP, listingsP, holderP]) p?.catch(() => undefined)

  // The index snapshot is mandatory: without original pixels and the census nothing can be computed honestly.
  let snap: MarketSnapshot
  try {
    snap = await snapshotP
    sources.index = { ok: true, note: snap.oldestIndexedAt ? `oldest row indexed ${snap.oldestIndexedAt}` : undefined }
  } catch (e) {
    throw new SourceError("index", `index unavailable: ${e instanceof Error ? e.message : e}`)
  }
  const ctx = { livingSupply: snap.livingSupply, censusTotal: snap.censusTotal, yieldMode }
  if (snap.oldestIndexedAt) {
    caveats.push(`The census and original pixel counts come from an index whose oldest row is from ${snap.oldestIndexedAt.slice(0, 16).replace("T", " ")} UTC; ownership may have changed since. Your own tokens are read live.`)
  }

  // Market listings: optional. If it fails we say so and still answer the wallet question.
  let listings: Listing[] = []
  let market: BurnBuyResult["market"] = null
  try {
    const raw = await listingsP
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
        customized: r.customized ?? false,
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
      holder = await (holderP as NonNullable<typeof holderP>)
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
        customized: t.customized ?? false,
      })
    }
    const own = new Set(held.map((h) => h.tokenId))
    // The census was built from the index; this wallet's holdings are live. Swap its index score for its live
    // score so 'everyone else' is exactly the census minus this wallet, and its share is computed consistently.
    const liveScore = walletScore(held.length, held.reduce((sum, h) => sum + h.actionPoints, 0))
    const indexScore = snap.walletScores.get(holder.address.toLowerCase()) ?? 0
    const walletCtx = { ...ctx, censusTotal: Math.max(0, snap.censusTotal - indexScore) + liveScore }
    const advice = adviseWallet(held, listings.filter((l) => !own.has(l.tokenId)), walletCtx)
    // Jev: a cautious second opinion on burn candidates only, only once the market is live and a key exists. Fail-safe:
    // any problem means no opinion and an honest note; the verdicts above are never touched.
    let jev: Record<number, JevOpinion> | undefined
    if (marketState === "live" && deps.jevOpinions) {
      const rarityById = new Map(tokens.map((t) => [t.id, t]))
      const candidates: JevToken[] = []
      for (const a of advice.tokens) {
        if (a.verdict !== "burn" || candidates.length >= JEV_MAX_TOKENS) continue
        const h = held.find((x) => x.tokenId === a.tokenId)
        const r = rarityById.get(a.tokenId)
        if (!h || !r) continue
        candidates.push({
          tokenId: h.tokenId, traits: r.traits ?? {}, originalPixels: h.originalPixels, pixelSupply: h.pixelSupply,
          actionPoints: h.actionPoints, level: Math.floor(h.actionPoints / 10) + 1, rank: h.rank, awakenedAgent: h.awakenedAgent,
          customized: r.customized ?? false,
        })
      }
      if (candidates.length > 0) {
        try {
          const res = await deps.jevOpinions(candidates)
          if (res) {
            jev = res.opinions
            sources.jev = { ok: true, note: `second opinion for ${Object.keys(res.opinions).length} of ${candidates.length} burn candidates` }
          }
        } catch (e) {
          sources.jev = { ok: false, error: `Jev second opinion unavailable: ${e instanceof Error ? e.message : e}` }
        }
      }
    }
    let delegateOf: Array<{ tokenId: number; owner: string }> = []
    if (held.length === 0) {
      if (deps.findDelegations) {
        try {
          delegateOf = await deps.findDelegations(holder.address)
        } catch (e) {
          caveats.push(`Could not check whether this wallet is a Canvas delegate: ${e instanceof Error ? e.message : e}`)
        }
      }
      if (delegateOf.length > 0) {
        const ids = delegateOf.map((d) => `#${d.tokenId}`).join(", ")
        const owners = [...new Set(delegateOf.map((d) => d.owner))].join(", ")
        advice.notes.push(
          `This wallet owns no Normies, but it is the Canvas delegate for ${ids}. A delegate can edit pixels but cannot burn, ` +
            `claim AP or transfer, so burn and buy advice needs the OWNER wallet: ${owners}.`,
        )
      } else {
        advice.notes.push(
          `${holder.ens ? `${holder.ens} resolves to ${holder.address}, which` : `${holder.address}`} owns no Normies and is not a Canvas delegate for any. ` +
            "If your Normie sits in another wallet, enter that wallet's address instead.",
        )
      }
    }
    wallet = {
      address: holder.address,
      ens: holder.ens,
      delegateOf,
      advice: {
        ...advice,
        holdings: held.map((h) => ({ tokenId: h.tokenId, originalPixels: h.originalPixels, actionPoints: h.actionPoints, rank: h.rank, type: h.type })),
      },
      historicalIllustration: {
        payoutEthIfSharePaidLikeArticleWindow: historicalPayoutEth(advice.sharePct),
        source: ARTICLE_WINDOW.source,
      },
      ...(jev ? { jev } : {}),
    }
  }

  return {
    asOf: deps.now().toISOString(),
    yieldMode,
    marketState,
    promo: { ...(yieldMode === "normal" ? NORMAL_INFO : PROMO_INFO), window: promoWindow(deps.now(), deps.yieldPinned ? deps.yieldPinned() : false) },
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
