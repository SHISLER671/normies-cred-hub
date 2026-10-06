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
import { contractRate, matchesKnownTiers, type BurnContractStatus } from "./contract-state"
import { resolveMarketState } from "./switches"
import { cliffCost, sellRows, type PixelMarketSnapshot, type PixelMarketView } from "./market-math"
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

/** Which source answered. `opensea` = the Normies API listings were unavailable, so these are the cheapest listings straight from OpenSea. */
export interface ListingsResult {
  items: RawListing[]
  floorEth: number | null
  total: number
  source?: "normies-api" | "opensea"
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
  fetchListings(): Promise<ListingsResult>
  loadSnapshot(): Promise<MarketSnapshot>
  /** Tokens this address is the Canvas delegate for (it can edit pixels but cannot burn). Optional. */
  findDelegations?(address: string): Promise<Array<DelegatedToken>>
  /** Jev's second opinion on burn candidates. Optional. Returns null when Jev is off (no key / kill switch). Only called when the market is live. */
  jevOpinions?(tokens: JevToken[]): Promise<{ opinions: Record<number, JevOpinion> } | null>
  /** How a burn pays. Optional; missing means "promo" (today). Real deps read BURN_YIELD_MODE. `now` is the request's one clock reading. */
  yieldMode?(now?: Date): YieldMode
  /** True when the site owner pinned the yield mode (BURN_YIELD_MODE) instead of letting the clock decide. Optional; missing means false. */
  yieldPinned?(now?: Date): boolean
  /** What the Normies contract itself reports (official /canvas/status). Optional. Null means unknown, and the clock decides. Never throws. */
  contractStatus?(): Promise<BurnContractStatus | null>
  /** Whether Pixel Market is open. Optional; missing means "pending" (today). Real deps read PIXEL_MARKET. */
  marketState?(): MarketState
  /** The site owner's pin (PIXEL_MARKET=live|pending), or null. Without a pin the contract status decides. */
  marketPin?(): MarketState | null
  /** The Pixel Market's live order book (best ask, depth, fee). Only called once the market is live; null = could not be read. */
  pixelMarket?(): Promise<PixelMarketSnapshot | null>
  /** #PIXEL a wallet holds outside its Normies (in the wallet + in open listings). Null when it could not be read. Optional. */
  loosePixels?(address: string): Promise<number | null>
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
  /** Who decided marketState: the site owner's pin, the Normies contract itself (checked live), or the default (closed). */
  marketSource: "pinned" | "contract" | "default"
  /** In normal mode `ratePercent` is null: the rate is a roll inside a tier range, described in `basis`. */
  promo: {
    ratePercent: number | null
    basis: string
    ends: string
    window: PromoWindow
    /** Who decided yieldMode: the site owner's pin, the Normies contract itself (checked live), or the clock (a guess from the announced window). */
    source: "pinned" | "contract" | "clock"
    /** The contract's own numbers when they could be read, otherwise null. */
    contract: BurnContractStatus | null
  }
  wallet: null | {
    address: string
    ens: string | null
    /** Set when the wallet owns nothing but is a Canvas delegate: burn advice needs the owner wallet. */
    delegateOf: Array<DelegatedToken>
    advice: WalletAdvice & { holdings: Array<{ tokenId: number; originalPixels: number; actionPoints: number; rank: number | null; type: string | null }> }
    historicalIllustration: { payoutEthIfSharePaidLikeArticleWindow: number; source: string }
    /** Priced from the live order book: the cost to reach the next boost, and what selling would net. Null without a live book. */
    pixelMarketView: PixelMarketView | null
    /** Jev's second opinion per burn candidate (only when the market is live and Jev is on). It never changes a verdict. */
    jev?: Record<number, JevOpinion>
  }
  /** The live Pixel Market order book (best ask, last fill, depth, fee), or null when the market is not live or could not be read. */
  pixelMarket: PixelMarketSnapshot | null
  market: null | {
    floorEth: number | null
    listedCount: number
    bestPixelFodder: FodderPick[]
    bestApCarriers: FodderPick[]
    skippedListings: number
  }
  census: { wallets: number; totalScore: number; livingSupply: number; indexOldestIndexedAt: string | null }
  sources: Record<SourceName, SourceStatus> & { pixelMarket?: SourceStatus }
  caveats: string[]
}

function cliffMath(advice: WalletAdvice, book: PixelMarketSnapshot, othersScore: number) {
  const next = advice.cliffs.pixel.next
  return cliffCost(advice.held, advice.pixel, next, book.depth, othersScore)
}

export const NORMAL_INFO = {
  ratePercent: null,
  basis: "a roll inside a range set by the burned Normie's original pixel count (under 490 px 1-4%, 490-889 px 2-4%, 890+ px 3-4%, confirmed in the Normies contract), plus the burned token's own AP",
  ends: "The fixed 4% promo has ended, or closes by 18:00 UTC at the latest; this page uses the normal rolls from 16:00 UTC",
} as const

export const NORMAL_INFO_CONTRACT = {
  ratePercent: null,
  basis: NORMAL_INFO.basis,
  ends: "The fixed 4% promo has ended: the Normies contract itself (checked live) is back to the normal tiered roll",
} as const

export const PROMO_INFO = {
  ratePercent: 4,
  basis: "4% of the burned Normie's original (base) pixel count, plus the burned token's own AP",
  ends: "Announced by the official Normies Discord: ends at 2:00 AM Guam time = 16:00 UTC on Monday, October 5. The Normies contract returned to the normal 1-4% tiers at about 16:23 UTC; burns now pay a roll inside the tier range",
} as const

/** Largest holder today has 432. Above this we refuse rather than show a wrong (truncated) score. */
const MAX_TOKENS = 1000

/**
 * The page and the API have 20 s in total (maxDuration). Jev is optional, so it is only asked when there is clearly
 * time left; otherwise the answer goes out without a second opinion and says so.
 */
export const JEV_START_BUDGET_MS = 10_000

function fail(source: SourceName, e: unknown): SourceStatus {
  return { ok: false, error: e instanceof Error ? e.message : String(e) }
}

export async function buildBurnBuy(input: { wallet?: string }, deps: Deps): Promise<BurnBuyResult> {
  // ONE clock reading per answer. Yield mode, the promo window, staleness and asOf all use it, so a request that
  // spans 16:00:00 UTC can never come back half promo, half normal.
  const now = deps.now()
  const startedAt = Date.now() // real elapsed time, for the Jev budget (deps.now may be a fixed test clock)
  const sources: BurnBuyResult["sources"] = {
    holder: { ok: true, note: "not requested" },
    rarity: { ok: true, note: "not requested" },
    listings: { ok: true },
    index: { ok: true },
    jev: { ok: true, note: "off" },
  }
  // Who decides how a burn pays: the site owner's pin, else the contract itself (checked live), else the clock's guess.
  const pinned = deps.yieldPinned ? deps.yieldPinned(now) : false
  const clockMode: YieldMode = deps.yieldMode ? deps.yieldMode(now) : "promo"
  const contract = deps.contractStatus ? await deps.contractStatus().catch(() => null) : null
  const rate = contractRate(contract)
  const yieldMode: YieldMode = pinned ? clockMode : rate === "fixed" ? "promo" : rate === "tiered" ? "normal" : clockMode
  const modeSource: BurnBuyResult["promo"]["source"] = pinned ? "pinned" : rate === "unknown" ? "clock" : "contract"
  const marketDecision = resolveMarketState(deps.marketPin ? deps.marketPin() : null, contract, deps.marketState ? deps.marketState() : "pending")
  const marketState: MarketState = marketDecision.state
  // The live order book (cached upstream of here; a 3 s cap). Null when the market is not live, no dependency is wired, or it could not be read.
  const pixelBook: PixelMarketSnapshot | null = marketState === "live" && deps.pixelMarket ? await deps.pixelMarket().catch(() => null) : null
  if (marketState === "live" && deps.pixelMarket) {
    sources.pixelMarket = pixelBook ? { ok: true, note: pixelBook.paused ? "market is paused" : undefined } : { ok: false, error: "the Pixel Market order book could not be read" }
  }
  const caveats: string[] = [
    "Burns are permanent. Verify on normies.art before you burn; this page cannot see the chain in real time.",
    "A burn is two steps on the Canvas: commit, then reveal about a minute later. Reveal within about 50 minutes, or each burned Normie pays only the minimum of its tier.",
    marketState !== "live"
      ? "Not financial advice. #PIXEL has no market price yet, so moves are compared by score, not value."
      : pixelBook
        ? "Not financial advice. Moves are ranked by score. The live #PIXEL order book (best ask, depth, fee) is shown beside them for comparison; it is thin and can change in minutes, so treat every price as a snapshot."
        : "Not financial advice. The #PIXEL order book could not be read this time, so moves are compared by score, not value.",
    "Yield uses each token's ORIGINAL pixel count (what the contract pays on), not its current edited art.",
    ...(contract?.paused ? ["Burning is paused on the Normies contract right now, so nothing can be burned until it reopens. Figures show what a burn would pay once it does."] : []),
    ...(contract && rate === "tiered" && !matchesKnownTiers(contract)
      ? [`The Normies contract reports tier minimums of ${contract.tierMinPercents.join(", ")}% (up to ${contract.maxBurnPercent}%) at ${contract.tierThresholds.join(" and ")} pixels, which differs from the ranges this page uses (1, 2, 3% up to 4% at 490 and 890). Treat the burn figures here as approximate.`]
      : []),
    ...(contract && rate === "unknown"
      ? [`The Normies contract reports an unusual burn setting (${contract.tierMinPercents.join(", ")}% minimums, ${contract.maxBurnPercent}% maximum), so this page is falling back to the announced schedule.`]
      : []),
    ...(pinned && contract && rate !== "unknown" && (rate === "fixed" ? "promo" : "normal") !== clockMode
      ? [`The site owner has pinned the burn rate, but the Normies contract currently reports ${rate === "fixed" ? "a fixed 4%" : "the normal tiered roll"}. Check normies.art before you burn.`]
      : []),
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
  const ctx = { livingSupply: snap.livingSupply, censusTotal: snap.censusTotal, yieldMode, marketState }
  if (snap.oldestIndexedAt) {
    caveats.push(`The census and original pixel counts come from an index last refreshed ${snap.oldestIndexedAt.slice(0, 16).replace("T", " ")} UTC; ownership may have changed since. Your own tokens are read live.`)
    if (isStale(snap.oldestIndexedAt, now.toISOString())) caveats.push(`That index is more than ${STALE_HOURS} hours old, so the pool share and "everyone else" figures are approximate until it refreshes.`)
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
      bestPixelFodder: rankFodder(listings, ctx, { withAp: false, limit: 10, askEth: pixelBook?.bestAskEth ?? null }),
      bestApCarriers: rankFodder(listings, ctx, { withAp: true, limit: 10, askEth: pixelBook?.bestAskEth ?? null }),
      skippedListings: skipped,
    }
    if (raw.items.length > 0 && listings.length === 0) {
      // Every listing was skipped: the moves and the fodder table would silently vanish. Say so instead.
      sources.listings = { ok: false, error: `all ${skipped} listings were skipped: none are in the index yet` }
    } else if (skipped > 0) {
      sources.listings = { ok: true, note: `${skipped} listings skipped: not in the index yet` }
    }
    if (raw.source === "opensea" && sources.listings.ok) {
      const via = `listings come from OpenSea, because the Normies API listings were unavailable: the cheapest ${raw.items.length} only`
      sources.listings = { ok: true, note: sources.listings.note ? `${via}; ${sources.listings.note}` : via }
      caveats.push(`Listings come straight from OpenSea right now (the Normies API listings were unavailable), and only the cheapest ${raw.items.length} are read, so the "cheapest #PIXEL" picks come from that set. The floor is OpenSea's.`)
    }
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
    // Delegations are looked up in parallel with the work below, for EVERY wallet: a hot wallet can own a few Normies and still act for a vault.
    const delegationsP = deps.findDelegations
      ? deps.findDelegations(holder.address).then(
          (list) => ({ ok: true as const, list }),
          (e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e) }),
        )
      : null
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

    // No fair value and no floor means the sale value is UNKNOWN (null), never 0: a 0 made "burn your own" look free
    // and pushed it to the top of the moves whenever the listings source was down.
    const floor = market?.floorEth ?? null
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
    const loose = deps.loosePixels ? await deps.loosePixels(holder.address).catch(() => null) : 0
    if (loose === null) caveats.push("Could not read this wallet's loose #PIXEL (in the wallet or listed on the market), so only pixels on its Normies are counted here.")
    else if (loose > 0) caveats.push(`Includes ${loose} #PIXEL held outside your Normies (in the wallet or listed on the Pixel Market): they count for the score exactly like pixels on a Normie.`)
    const liveScore = walletScore(held.length, held.reduce((sum, h) => sum + h.actionPoints, 0) + (loose ?? 0))
    const indexScore = snap.walletScores.get(holder.address.toLowerCase()) ?? 0
    const walletCtx = { ...ctx, censusTotal: Math.max(0, snap.censusTotal - indexScore) + liveScore }
    const advice = adviseWallet(held, listings.filter((l) => !own.has(l.tokenId)), walletCtx, loose ?? 0)
    // Priced from the live book: what reaching the next boost would cost, and what selling would net. Never a verdict.
    let pixelMarketView: PixelMarketView | null = null
    if (pixelBook && held.length > 0) {
      const othersScore = Math.max(0, walletCtx.censusTotal - advice.score)
      const prices: Array<{ label: string; priceEth: number }> = []
      const addPrice = (label: string, priceEth: number | null | undefined) => {
        if (priceEth && priceEth > 0 && !prices.some((p) => Math.abs(p.priceEth - priceEth) < 1e-9)) prices.push({ label, priceEth })
      }
      addPrice("the best ask", pixelBook.bestAskEth)
      addPrice("the last fill", pixelBook.lastPriceEth)
      addPrice("what the cheapest burn costs per #PIXEL", market?.bestPixelFodder[0]?.ethPerPixel)
      const floor = advice.cliffs.pixel.floor
      pixelMarketView = {
        cliffCost: cliffMath(advice, pixelBook, othersScore),
        sell: advice.pixel > 0
          ? sellRows({ held: advice.held, pixel: advice.pixel, spare: floor ? floor.spare : advice.pixel, prices, depth: pixelBook.depth, feeBps: pixelBook.feeBps, othersScore })
          : [],
      }
      const i = advice.notes.findIndex((n) => n.startsWith("Scores use the published formula."))
      if (i >= 0) advice.notes[i] = "Scores use the published formula. Moves are ranked by score; live #PIXEL prices from the order book are shown beside them, as a snapshot."
    }
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
      if (candidates.length > 0 && Date.now() - startedAt > JEV_START_BUDGET_MS) {
        sources.jev = { ok: false, error: "Jev second opinion skipped: the other lookups were slow, so there was no time left to ask" }
      } else if (candidates.length > 0) {
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
    let delegateOf: Array<DelegatedToken> = []
    let checkFailed = false
    if (delegationsP) {
      const r = await delegationsP
      if (r.ok) {
        const own = new Set(held.map((h) => h.tokenId))
        delegateOf = r.list.filter((d) => !own.has(d.tokenId))
      } else {
        checkFailed = true
        // Only worth a caveat when it matters: a wallet that owns Normies gets its own answer either way.
        if (held.length === 0) caveats.push(`Could not check whether this wallet is a delegate (Canvas or Delegate.xyz): ${r.error}`)
      }
    }
    if (held.length === 0) {
      if (delegateOf.length > 0) {
        const owners = ownerList(delegateOf)
        const kinds = delegateKinds(delegateOf)
        advice.notes.push(
          kinds === "Canvas"
            ? `This wallet owns no Normies, but it is the Canvas delegate for ${idSummary(delegateOf)}. A delegate can edit pixels but cannot burn, ` +
                `claim AP or transfer, so burn and buy advice needs the OWNER wallet: ${owners}.`
            : `This wallet owns no Normies, but it is a ${kinds} delegate for ${idSummary(delegateOf)}. A delegate is not the owner and cannot burn ` +
                `on the owner's behalf, so burn and buy advice needs the OWNER wallet: ${owners}.`,
        )
      } else if (checkFailed) {
        advice.notes.push(
          `${holder.address} owns no Normies, and we could not check whether it is a delegate, so we cannot say it is not one. ` +
            "If your Normie sits in another wallet, enter that wallet's address instead, or try again in a minute.",
        )
      } else {
        advice.notes.push(
          `${holder.ens ? `${holder.ens} resolves to ${holder.address}, which` : `${holder.address}`} owns no Normies and is not a Canvas or Delegate.xyz delegate for any. ` +
            "If your Normie sits in another wallet, enter that wallet's address instead.",
        )
      }
    } else if (delegateOf.length > 0) {
      const owners = ownerList(delegateOf)
      advice.notes.push(
        `This wallet also acts as a ${delegateKinds(delegateOf)} delegate for ${idSummary(delegateOf)}, which it does not own. ` +
          `The advice above covers only what this wallet owns; burn advice for those needs the OWNER wallet: ${owners}.`,
      )
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
      pixelMarketView,
      ...(jev ? { jev } : {}),
    }
  }

  return {
    asOf: now.toISOString(),
    yieldMode,
    marketState,
    marketSource: marketDecision.source,
    promo: {
      ...(yieldMode === "normal" ? (modeSource === "contract" ? NORMAL_INFO_CONTRACT : NORMAL_INFO) : PROMO_INFO),
      window: promoWindow(now, pinned),
      source: modeSource,
      contract: contract ?? null,
    },
    wallet,
    pixelMarket: pixelBook,
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

/** The index is refreshed daily by scheduled jobs; older than this means a job has been failing and the census is approximate. */
export const STALE_HOURS = 36
export const isStale = (refreshedIso: string, nowIso: string) => Date.parse(nowIso) - Date.parse(refreshedIso) > STALE_HOURS * 3_600_000

/** A Normie this wallet is only a DELEGATE for: who owns it, and where the delegation lives (missing means Canvas). */
export interface DelegatedToken { tokenId: number; owner: string; via?: "canvas" | "delegate.xyz" | "both" }

/** "Canvas", "Delegate.xyz" or "Canvas and Delegate.xyz", from where the delegations live. */
export function delegateKinds(list: readonly DelegatedToken[]): string {
  const canvas = list.some((d) => d.via === undefined || d.via === "canvas" || d.via === "both")
  const dx = list.some((d) => d.via === "delegate.xyz" || d.via === "both")
  return canvas && dx ? "Canvas and Delegate.xyz" : dx ? "Delegate.xyz" : "Canvas"
}

/** "#7141", "#9 and #30", or for a big vault "378 Normies (including #30, #38, #61)". */
export function idSummary(list: readonly DelegatedToken[]): string {
  const ids = list.map((d) => d.tokenId)
  if (ids.length <= 4) return ids.length === 1 ? `#${ids[0]}` : ids.slice(0, -1).map((i) => `#${i}`).join(", ") + ` and #${ids[ids.length - 1]}`
  return `${ids.length} Normies (including ${ids.slice(0, 3).map((i) => `#${i}`).join(", ")})`
}

/** Distinct owners, in full for up to three, then "and 5 more": a hot wallet can act for hundreds of vaults. */
export function ownerList(list: readonly DelegatedToken[]): string {
  const owners = [...new Set(list.map((d) => d.owner))]
  return owners.length <= 3 ? owners.join(", ") : `${owners.slice(0, 3).join(", ")} and ${owners.length - 3} more`
}
