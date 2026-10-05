// Turns a BurnBuyResult into plain sentences for the /burn page. Pure: no I/O, no React.
// Rule: every number shown here is copied from the result, never recomputed, so the page cannot disagree with the API.

import type { Move, Verdict } from "./advise"
import type { CliffCost, PixelMarketSnapshot, SellRow } from "./market-math"
import type { JevVerdict } from "./jev"
import { BOOSTS, BRACKETS, boostFor, type CliffSide, bracketMultiplier, walletScore, type MarketState, type YieldMode } from "./score"
import { delegateKinds, idSummary, type BurnBuyResult, type DelegatedToken } from "./service"

export type PageState = "no-wallet" | "empty" | "delegate-only" | "holds"

/** What the holder is burning FOR. Same data, different answer. */
export type Goal = "share" | "arena" | "art" | "sell"
export const GOALS: ReadonlyArray<{ id: Goal; label: string; blurb: string }> = [
  { id: "share", label: "Revenue share", blurb: "Grow your score and your slice of the pool." },
  { id: "arena", label: "Arena", blurb: "Protect the Normies you want to play with." },
  { id: "art", label: "Art", blurb: "Earn pixels to draw on the Normies you keep." },
  { id: "sell", label: "Sell", blurb: "Selling #PIXEL: what it nets, and what it does to your score." },
]
export const parseGoal = (v: string | null | undefined): Goal => (v === "arena" || v === "art" || v === "sell" ? v : "share")

/** Official formula (Normies docs): Level = floor(AP / 10) + 1. */
export const levelOf = (ap: number) => Math.floor(ap / 10) + 1

export interface TokenRow {
  tokenId: number
  verdict: Verdict
  /** Always words, never colour alone. */
  label: "BURN CANDIDATE" | "KEEP" | "EITHER"
  reasons: string[]
  /** What burning it would award, in plain words. */
  pays: string
  /** Short version for a tile: "+30 #PIXEL", "+30 AP" or "+30 px". */
  yieldText: string
  /** Jev's second opinion (only once the market is live and Jev is on). It never changes `verdict`; it can only add caution. */
  jev?: { verdict: JevVerdict; pRegret: number; text: string }
  originalPixels: number | null
  actionPoints: number | null
  type: string | null
  /** From the official formula; shown in Arena mode. */
  level: number | null
}

/** The page shows at most this many rows; a wallet can hold hundreds. */
export const MAX_ROWS = 50

export interface MoveLine {
  title: string
  detail: string
  /** Short before/after chip for the card, e.g. "Score 3.4 → 9.66". */
  stat: string
}

export interface LedgerRow {
  label: string
  value: string
  /** The two totals (your score, your share) are shown heavier. */
  strong?: boolean
}

export interface NextStep {
  title: string
  /** Score and share before and after, in one plain sentence. */
  detail: string
}

export interface PageModel {
  state: PageState
  /** The one-sentence answer. */
  headline: string
  /** Short plain sentences under the headline. */
  lines: string[]
  rows: TokenRow[]
  moves: MoveLine[]
  fodder: Array<{ tokenId: number; priceEth: number; pays: number; perEth: number; /** Live market only: burning this versus buying #PIXEL at the best ask, per #PIXEL, in plain words. Null without a live book. */ vsAsk: string | null; /** Live market only: the Normie price above which buying #PIXEL at the best ask would have been cheaper (a range at normal tiers). */ breakEven: string | null; /** ETH per #PIXEL if you burn it (price ÷ pays). */ ethPerPixel: number; /** Normal burn mode only: cheapest and dearest outcome per #PIXEL. */ ethPerPixelRange: { low: number; high: number } | null; url: string | null; /** Normal burn mode only: the full range one burn could pay. */ range: { min: number; max: number } | null }>
  /** A link to the normies.art revenue share simulator, pre-filled with this wallet's Normies and #PIXEL. Share goal only. */
  simulatorUrl: string | null
  /** How a burn pays ("normal" means a roll, so figures are shown as about / ~ with a range). */
  yieldMode: YieldMode
  /** Whether Pixel Market is open. */
  marketState: MarketState
  /** Where to go if this wallet is only a Canvas delegate. */
  delegateOf: Array<DelegatedToken>
  /** Warnings that must stay visible (for example: you cannot burn them all). Also present in `lines`. */
  notices: string[]
  goal: Goal
  /** "How your score adds up", line by line. Revenue share goal with Normies only; otherwise empty. */
  ledger: LedgerRow[]
  /** What the nearest multiplier or boost step would do to the score. Revenue share goal only; otherwise empty. */
  nextSteps: NextStep[]
  /** Where you stand against each cliff, in plain words: what the next step needs and what dropping below this one costs. Revenue share goal with Normies only; otherwise empty. */
  cliffNotes: string[]
  /** One line of live Pixel Market numbers (best ask, last fill, listed, 24h volume), or null without a live book. */
  marketLine: string | null
  /** The Sell view (Sell goal, a wallet with #PIXEL, a live book): reference-price rows and the plain limits. Otherwise null. */
  sellView: { rows: Array<{ label: string; net: string; detail: string }>; notes: string[] } | null
  /** Extra plain-language facts and limits for the chosen goal (shown in the disclaimer box). */
  goalNotes: string[]
}

const eth = (n: number) => `${n % 1 === 0 ? n.toFixed(0) : String(Number(n.toFixed(3)))} ETH`
const ids = (list: number[]) => list.map((i) => `#${i}`).join(" and ")
const num = (n: number) => String(Number(n.toFixed(2)))

const LABEL: Record<Verdict, TokenRow["label"]> = { burn: "BURN CANDIDATE", keep: "KEEP", neutral: "EITHER" }

/** Only ever link out to https URLs, never whatever string an upstream API sends. */
export function safeUrl(u: string | undefined | null): string | null {
  if (!u) return null
  try {
    const p = new URL(u)
    return p.protocol === "https:" ? p.toString() : null
  } catch {
    return null
  }
}

/** Plain words for Jev's opinion. Never says burn: Jev can only add caution. */
export function jevView(op: { verdict: JevVerdict; pRegret: number }) {
  const pct = Math.round(op.pRegret * 100)
  const text =
    op.verdict === "double-check"
      ? `Jev leans keep: about ${pct}% that you would regret this burn. Double-check before burning.`
      : op.verdict === "agrees"
        ? "Jev agrees: nothing about this one stands out."
        : `Jev is unsure (about ${pct}% regret). Your call.`
  return { verdict: op.verdict, pRegret: op.pRegret, text }
}

const NOTICE_OPEN = "The 4% rate ends at 16:00 UTC on Monday, October 5 (official Normies announcement). After that, burns go back to the normal 1 to 4% range."
const NOTICE_MAYBE_CLOSED = "The 4% rate has ended: the official Normies announcement put it at 16:00 UTC on Monday, October 5. Figures here use the normal roll. Check normies.art before you burn."
const NOTICE_PINNED_PAST = "This page is still showing the 4% rate because the site owner has pinned it, but the announced end has passed. Check normies.art before you burn."
const NOTICE_ENDED = "The 4% rate ended on Monday, October 5 at 16:00 UTC (official Normies announcement). Figures here use the normal roll."
const ENDED_NOTICE_MS = 72 * 3600 * 1000

const NOTICE_PAUSED = "Burning is paused on the Normies contract right now, so nothing can be burned until it reopens. Figures show what a burn would pay once it does."
const NOTICE_CONTRACT_FIXED = "The Normies contract is paying a fixed 4% right now (checked live). It is expected to return to the normal 1 to 4% range when the promo closes, officially announced for 16:00 UTC on Monday, October 5, so check again before you burn."
const NOTICE_CONTRACT_FIXED_LATE = "The Normies contract is still paying a fixed 4% (checked live), even though the announced end has passed. It can change at any moment, so check @normiesART before you burn."
const NOTICE_CONTRACT_NORMAL = "The Normies contract is back to the normal tiered roll (checked live), so the fixed 4% is over (it ended on Monday, October 5, as officially announced). Figures here use the normal roll."

/** The one sentence about the 4% window that fits the moment, or null. Uses the result's own clock; when the contract could be read, it wins over the clock. */
export function promoNotice(r: Pick<BurnBuyResult, "yieldMode" | "asOf"> & { promo: { window?: { state: string; latestEnd: string }; source?: string; contract?: { paused: boolean } | null } }): string | null {
  const w = r.promo.window
  if (r.promo.contract?.paused) return NOTICE_PAUSED
  if (r.promo.source === "contract") {
    if (r.yieldMode === "promo") return w && w.state === "closed" ? NOTICE_CONTRACT_FIXED_LATE : NOTICE_CONTRACT_FIXED
    if (w && Date.parse(r.asOf) < Date.parse(w.latestEnd) + ENDED_NOTICE_MS) return NOTICE_CONTRACT_NORMAL
    return null
  }
  if (!w) return null
  if (r.yieldMode === "promo") return w.state === "open" ? NOTICE_OPEN : NOTICE_PINNED_PAST
  if (w.state === "may-have-closed") return NOTICE_MAYBE_CLOSED
  if (w.state === "closed" && Date.parse(r.asOf) < Date.parse(w.latestEnd) + ENDED_NOTICE_MS) return NOTICE_ENDED
  return null
}

export function describeMove(m: Move, yieldMode: YieldMode = "promo"): MoveLine {
  const roll = yieldMode === "normal" ? " The burn itself is a roll, so this is a typical result." : ""
  const score = `Your score goes ${num(m.scoreBefore)} → ${num(m.scoreAfter)} (+${num(m.scoreGain)}). Your share of the pool: ${m.shareBeforePct}% → ${m.shareAfterPct}%.`
  const stat = `Score ${num(m.scoreBefore)} → ${num(m.scoreAfter)}`
  if (m.kind === "burn-own") {
    const cost = m.costKnown === false
      ? "Its sale value is unknown right now (no price data came back), so check what it would sell for before you burn."
      : `You give up about ${eth(m.costEth)} of sale value.`
    return {
      title: `Burn ${ids(m.tokenIds)} into the one(s) you keep`,
      detail: `Permanent. ${cost} ${score}${roll}`,
      stat,
    }
  }
  if (m.kind === "buy-and-burn") {
    return {
      title: `Buy ${ids(m.tokenIds)} for ${eth(m.costEth)}, then burn ${m.tokenIds.length > 1 ? "them" : "it"} into a Normie you hold`,
      detail: `Its #PIXEL and any AP it carries move to you. ${score}${roll}`,
      stat,
    }
  }
  return {
    title: `Buy ${ids(m.tokenIds)} for ${eth(m.costEth)} and keep ${m.tokenIds.length > 1 ? "them" : "it"}`,
    detail: `One more Normie in your stack. ${score}`,
    stat,
  }
}

const ARENA_NOTES = [
  "Arena is not open from this page, and this page cannot enter you into anything. The official Lab overview lists Arena as COMING SOON.",
  "Official design (@serc1n, Sep 18): autonomous agents on a 640×640 continent, no human players. Five camps: Human, Cat, Alien, Agent, Zombie. Type, Level and on-chain history matter.",
  "Level: every 10 pixels is one level, and the official Pixel Market video calls it a permanent trait. (The Sep 23 article said withdrawing #PIXEL strips a level, so check before you move pixels off a Normie.) In numbers, Level = floor(AP ÷ 10) + 1. Burning another Normie into one you keep adds AP to it, so it can raise its Level.",
  "The combat rules have NOT been published. Nobody can honestly tell you how many Normies to keep or what Level wins. Anyone who says they can is guessing, and so would we.",
  "If an agent dies in a round it waits for the next round and respawns. Death is not a burn. A burn is permanent.",
  "Official trailer (\"They play. You watch.\"): each agent decides for itself, using a decision model. You do not steer it, so your choice is which Normies you own and keep.",
  "The trailer shows a boss, The Maw (\"No Normie can face it alone\"), but gives no numbers.",
  "Whether a Normie must be awakened to enter, and when entry opens, is not published here. Check @normiesART.",
]

const ART_NOTES = [
  "Pixels on a Normie are its paint budget (official Pixel Market video). They set how many pixels of its face you may change. Painting never spends them, so you can repaint as often as you like.",
  "Every edit is saved on-chain forever, with the full history of versions. Pixels can also buy a bigger canvas (up to 80 wide) or wipe the face blank.",
  "If you have already drawn on a Normie, burning it erases that art for good, so this page marks every edited Normie KEEP. Burn yield is paid on the ORIGINAL pixel count, not your edited art.",
  "Pixel counts of rare Normies are a style choice as much as a number. If one means something to you, keep it.",
]

export const SIMULATOR_BASE = "https://simulator.normies.art/"
/** Opens the simulator with these holdings already typed in (it reads ?normies= and ?pixels=). No wallet address is put in the link. */
export function simulatorUrl(held: number, pixel: number): string {
  const n = Math.max(0, Math.trunc(held)), p = Math.max(0, Math.trunc(pixel))
  return `${SIMULATOR_BASE}?normies=${n}&pixels=${p}`
}

const fmtX = (n: number) => `${n}×`
const SHARE_NOTES = [
  "Where the pool comes from (official): half of every Pixel Market fee (taken from the seller) and half of the royalties on Normie resales go to the holder pool. It is paid out monthly, in rounds, and claimed on chain. Buyers pay the listed price and nothing extra.",
  "Holdings are checked at four random blocks a day, so what you hold DURING the month is what counts: half the month earns half. The share shown on this page is your points at today's holdings, not what you will be paid (the normies.art simulator says the same).",
  `Your share follows your score: (Normies × bracket + #PIXEL ÷ 5) × (1 + boost). Brackets: ${[...BRACKETS].reverse().map((b) => `${b.min}${b.min === 1 ? "" : " or more"} = ${fmtX(b.mult)}`).join(", ")}.`,
  `Boost, by #PIXEL held (on Normies, in your wallet, or listed): ${[...BOOSTS].reverse().map((b) => `${b.min.toLocaleString("en-US")} or more = +${Math.round(b.boost * 100)}%`).join(", ")}.`,
]

const SELL_NOTES = [
  "The Pixel Market is a sell-side order book (official): sellers list #PIXEL at a price, buyers buy listings. The market takes a 10% fee from the seller; buyers pay the listed price and nothing extra. Half of every fee goes to the holder pool.",
  "Prices here are reference points from today's book (the best ask, the last fill, and what the cheapest burn costs per #PIXEL), not a recommendation of where to list and not a prediction. The market is new and thin, so one sale can move the price.",
  "#PIXEL you have listed for sale still counts toward your score until it sells. Holdings are checked at four random blocks a day, so what counts is what you hold at those moments.",
  "Selling #PIXEL lowers your score even when your boost holds: each #PIXEL is worth 1/5 of a point. Falling below a boost line costs much more, because the boost applies to your whole score. The rows below show both.",
]

function fodderLine(f: PageModel["fodder"][number], goal: Goal, keeperAp: number | null): MoveLine {
  const base = `Buy #${f.tokenId} for ${eth(f.priceEth)} and burn it into a Normie you keep`
  if (goal === "arena") {
    const lvl = keeperAp === null
      ? `That is about +${num(f.pays / 10)} Levels (10 AP per Level).`
      : `Level ${levelOf(keeperAp)} → ${levelOf(keeperAp + f.pays)}.`
    const about = f.range ? "about " : ""
    const span = f.range ? ` (${f.range.min} to ${f.range.max}, it is a roll)` : ""
    return { title: base, detail: `Adds ${about}${f.pays} AP to it${span}. ${lvl}`, stat: keeperAp === null ? `${f.range ? "~" : ""}+${num(f.pays / 10)} Levels` : `Level ${levelOf(keeperAp)} → ${f.range ? "~" : ""}${levelOf(keeperAp + f.pays)}` }
  }
  return { title: base, detail: `Adds ${f.range ? "about " : ""}${f.pays} pixels to it${f.range ? ` (${f.range.min} to ${f.range.max}, it is a roll)` : ""}, so you can repaint more of its face (${f.perEth} per ETH).`, stat: `${f.range ? "~" : ""}+${f.pays} px` }
}

export function buildPageModel(result: BurnBuyResult | null, goal: Goal = "share"): PageModel {
  const goalNotes = goal === "arena" ? ARENA_NOTES : goal === "art" ? ART_NOTES : goal === "sell" ? SELL_NOTES : SHARE_NOTES
  const yieldMode: YieldMode = result?.yieldMode ?? "promo"
  const marketState: MarketState = result?.marketState ?? "pending"
  const base: PageModel = { simulatorUrl: null, yieldMode, marketState, state: "no-wallet", headline: "Paste a wallet to get your answer.", lines: [], rows: [], moves: [], fodder: [], delegateOf: [], notices: [], goal, goalNotes, ledger: [], nextSteps: [], cliffNotes: [], marketLine: null, sellView: null }
  if (!result) return base

  const fodder = (result.market?.bestPixelFodder ?? []).slice(0, 5).map((f) => ({
    tokenId: f.tokenId,
    priceEth: f.priceEth,
    pays: f.yieldTotal,
    perEth: f.yieldPerEth,
    vsAsk: vsAskText(f.vsAsk, result.pixelMarket?.bestAskEth ?? null),
    breakEven: breakEvenText(f.breakEvenNormieEth),
    ethPerPixel: f.ethPerPixel,
    ethPerPixelRange: f.ethPerPixelLow !== undefined && f.ethPerPixelHigh !== undefined ? { low: f.ethPerPixelLow, high: f.ethPerPixelHigh } : null,
    url: safeUrl(f.url),
    range: f.yieldMin !== undefined && f.yieldMax !== undefined ? { min: f.yieldMin, max: f.yieldMax } : null,
  }))

  const marketLine = marketLineText(result.pixelMarket ?? null)
  base.marketLine = marketLine

  // Listings down: say so ON the answer, not only in the folded fine print. Without this the moves and the fodder table
  // silently vanished and the headline read "Nothing to do right now" (live, 2026-10-04 21:55 UTC).
  const listingsDown = result.sources?.listings?.ok === false
  const marketNotice = listingsDown
    ? "Market listings did not load this time, so buy moves and the cheapest #PIXEL table are missing. Try again in a minute."
    : null

  const w = result.wallet
  if (!w) return { ...base, fodder, notices: marketNotice ? [marketNotice] : [] }

  const { advice } = w
  if (advice.held === 0) {
    if (w.delegateOf.length > 0) {
      return {
        ...base,
        state: "delegate-only",
        headline: delegateKinds(w.delegateOf) === "Canvas" ? "This wallet can edit pixels on a Normie, but it cannot burn it." : "This wallet is a delegate, not the owner, so it cannot burn these Normies.",
        lines: [
          `It is a ${delegateKinds(w.delegateOf)} delegate for ${idSummary(w.delegateOf)}. Burn advice needs the OWNER wallet.`,
          "Use the owner wallet below to see what to burn and what to keep.",
        ],
        delegateOf: w.delegateOf,
        fodder,
      }
    }
    return {
      ...base,
      state: "empty",
      headline: "This wallet holds no Normies.",
      lines: [
        "A wallet with no Normies scores zero, whatever #PIXEL it has: your first Normie is the membership.",
        "Check the spelling, or paste the wallet that actually owns them (not a delegate or a different address).",
      ],
      moves: goal === "share" ? advice.moves.slice(0, 3).map((m) => describeMove(m, yieldMode)) : [],
      fodder,
      notices: marketNotice ? [marketNotice] : [],
    }
  }

  const holdings = new Map(advice.holdings.map((h) => [h.tokenId, h]))
  const typeCount = new Map<string, number>()
  for (const h of advice.holdings) if (h.type) typeCount.set(h.type, (typeCount.get(h.type) ?? 0) + 1)

  const rows: TokenRow[] = advice.tokens.map((t) => {
    const h = holdings.get(t.tokenId)
    let verdict: Verdict = t.verdict
    let reasons = t.reasons
    const type = h?.type ?? null
    // Your only Normie is never "burn it": the engine cannot burn it into anything, and it would end your membership.
    if (advice.held === 1 && verdict !== "keep") {
      verdict = "keep"
      reasons = ["your only Normie: burning it would end your membership and leave nothing to burn into"]
    }
    if (goal === "arena") {
      if (type && type.toLowerCase() !== "human") {
        const n = typeCount.get(type) ?? 1
        reasons = [`${type}: one of the five Arena camps. ${n === 1 ? `It is your only ${type}, so burning it removes your ${type} from the Arena.` : `You hold ${n} of them.`}`, ...reasons]
      }
      if (verdict === "burn") reasons = [`burning adds ${t.yield.range ? "about " : ""}${t.yield.total} AP to a Normie you keep (10 AP = 1 Level)`]
    }
    if (goal === "art" && verdict === "burn") {
      reasons = [`burning adds ${t.yield.range ? "about " : ""}${t.yield.total} pixels to a Normie you keep. If you have drawn on this one, that art is lost`]
    }
    return {
      tokenId: t.tokenId,
      verdict,
      label: LABEL[verdict],
      reasons,
      ...(w.jev?.[t.tokenId] ? { jev: jevView(w.jev[t.tokenId]) } : {}),
      yieldText: t.yield.total > 0 ? `+${t.yield.range ? "~" : ""}${t.yield.total} ${goal === "art" ? "px" : goal === "arena" ? "AP" : "#PIXEL"}` : "+0",
      pays: t.yield.total > 0
        ? goal === "art"
          ? `Burning would add ${t.yield.range ? "about " : ""}${t.yield.total} pixels to a Normie you keep${t.yield.range ? ` (${t.yield.range.min + t.yield.transferred} to ${t.yield.range.max + t.yield.transferred})` : ""}.`
          : t.yield.range
            ? `Burning would pay about ${t.yield.total} #PIXEL (${t.yield.range.min + t.yield.transferred} to ${t.yield.range.max + t.yield.transferred}; it is a roll${t.yield.transferred > 0 ? `, includes ${t.yield.transferred} AP carried over` : ""}).`
            : `Burning would pay ${t.yield.total} #PIXEL (${t.yield.fromPixels} from pixels${t.yield.transferred > 0 ? `, ${t.yield.transferred} AP carried over` : ""}).`
        : "Burning would pay nothing.",
      originalPixels: h?.originalPixels ?? null,
      actionPoints: h?.actionPoints ?? null,
      type,
      level: h ? levelOf(h.actionPoints) : null,
    }
  })

  const burnRows = rows.filter((r) => r.verdict === "burn")
  const burnN = burnRows.length
  const keepRows = rows.filter((r) => r.verdict === "keep")
  const keepN = keepRows.length
  const eitherN = rows.length - burnN - keepN
  // Burning needs a Normie left to receive it: with nothing kept, at most held-1 can go. Count only what is possible.
  const cap = keepN > 0 ? burnN : Math.max(0, advice.held - 1)
  const burnYields = advice.tokens
    .filter((t) => burnRows.some((r) => r.tokenId === t.tokenId))
    .map((t) => t.yield.total)
    .sort((a, b) => b - a)
  const spareYield = burnYields.slice(0, cap).reduce((sum, y) => sum + y, 0)
  const lone = keepN === 1 ? holdings.get(keepRows[0].tokenId) : undefined
  const keeperAp = lone ? lone.actionPoints : null

  const lines: string[] = [
    `You hold ${advice.held} Normie${advice.held === 1 ? "" : "s"} and ${advice.pixel} #PIXEL. Score ${num(advice.score)}, about ${advice.sharePct}% of the pool at today's holdings.`,
  ]
  if (burnN === 0) lines.push(`Nothing here is a burn candidate: ${keepN} to keep${eitherN > 0 ? `, ${eitherN} either way` : ""}.`)
  else lines.push(`${burnN} burn candidate${burnN === 1 ? "" : "s"}, ${keepN} to keep${eitherN > 0 ? `, ${eitherN} either way` : ""}. A candidate is only "nothing says keep and it pays something", not an order.`)
  const notices: string[] = []
  if (marketNotice) notices.push(marketNotice)
  const windowNotice = promoNotice(result)
  if (windowNotice) notices.push(windowNotice)
  if (w.delegateOf.length > 0) {
    const also = `This wallet also acts as a ${delegateKinds(w.delegateOf)} delegate for ${idSummary(w.delegateOf)}, which it does not own. The answer below covers only what it owns; use the owner wallet (listed under the answer) for the rest.`
    lines.push(also)
    notices.push(also)
  }
  if (burnN > 0 && burnN >= advice.held && advice.held > 1) {
    const cap = `Burning needs a Normie left to receive it, so at most ${advice.held - 1} of these ${advice.held} can go.`
    lines.push(cap)
    notices.push(cap)
  }
  if (goal === "share") {
    if (advice.nextBracket) lines.push(`${advice.nextBracket.needMore} more Normie${advice.nextBracket.needMore === 1 ? "" : "s"} lifts your whole stack to the next bracket (at ${advice.nextBracket.atHeld}).`)
    if (advice.nextBoost) lines.push(`${advice.nextBoost.needMore} more #PIXEL reaches the next boost (at ${advice.nextBoost.atPixel}).`)
    lines.push(...advice.notes)
  } else if (goal === "arena") {
    if (lone) lines.push(`Your Arena Normie is #${lone.tokenId}${lone.type ? ` (${lone.type})` : ""}: Level ${levelOf(lone.actionPoints)} with ${lone.actionPoints} AP.`)
    else if (keepN > 1) lines.push(`Your fighters: ${keepRows.map((r) => `#${r.tokenId}${r.type ? ` ${r.type}` : ""} (Level ${r.level})`).join(", ")}.`)
  } else if (goal === "sell") {
    // The Sell view needs no per-Normie lines: the numbers are in the section below.
  } else {
    lines.push("Pixels on a Normie are its paint budget: they set how many pixels of its face you can change. Painting never uses them up.")
  }

  let headline: string
  let moves: MoveLine[]
  if (goal === "share") {
    const best = advice.moves[0]
    headline = best
      ? `Best move right now: ${describeMove(best, yieldMode).title}.`
      : listingsDown
        ? "Market data did not load, so we cannot rank moves right now. Try again in a minute."
        : "Nothing to do right now: no move improves your score."
    moves = advice.moves.slice(0, 3).map((m) => describeMove(m, yieldMode))
  } else if (goal === "sell") {
    headline = sellHeadline(advice.pixel, advice.cliffs.pixel.floor, w.pixelMarketView?.sell ?? [], result.pixelMarket ?? null, marketState)
    moves = []
  } else {
    const picks = fodder.slice(0, 3).map((f) => fodderLine(f, goal, keeperAp))
    moves = picks
    if (goal === "arena") {
      headline = advice.held === 1
        ? "Keep it. It is your only Normie, so it is your only player."
        : burnN === 0
          ? "Arena plan: keep everything you hold. Nothing here is spare."
          : keepN === 0
            ? `Arena plan: keep at least 1 as your fighter. Up to ${cap} of the others could go for up to +${spareYield} AP.`
            : `Arena plan: keep ${keepN} fighter${keepN === 1 ? "" : "s"}. ${burnN} spare could go for +${spareYield} AP, if you want the Level.`
    } else {
      headline = advice.held === 1
        ? "Keep it. To raise how much of its face you can repaint, burn another Normie into it, for example one you buy (see below)."
        : burnN === 0
          ? "Art plan: keep what you hold. Nothing here is spare to burn."
          : keepN === 0
            ? `Art plan: keep at least 1 to paint. Burning up to ${cap} of the others adds up to ${spareYield} pixels.`
            : `Art plan: burning your ${burnN} spare adds ${spareYield} pixels to the ones you keep.`
    }
  }

  const { ledger, nextSteps } = goal === "share" ? scoreBreakdown(advice) : { ledger: [], nextSteps: [] }
  const view = w.pixelMarketView ?? null
  const cliffNotes = goal === "share" || goal === "sell" ? [...cliffSentences(advice.cliffs), ...cliffCostSentences(view?.cliffCost ?? null)] : []
  const sellView = goal === "sell" ? buildSellView(view?.sell ?? [], advice.pixel, result.pixelMarket ?? null) : null
  return { state: "holds", simulatorUrl: goal === "share" && advice.held >= 1 ? simulatorUrl(advice.held, advice.pixel) : null, yieldMode, marketState, headline, lines, rows: goal === "sell" ? [] : rows, moves, fodder: goal === "sell" ? [] : fodder, delegateOf: w.delegateOf, notices, goal, goalNotes, ledger, nextSteps, cliffNotes, marketLine, sellView }
}

/**
 * Plain words for the cliffs: how far to the next step, and what selling or burning below the current one would cost.
 * Pure arithmetic on the published ladders, so it holds at any #PIXEL price. Listed #PIXEL still counts until it sells.
 */
export function cliffSentences(c: { normies: CliffSide; pixel: CliffSide }): string[] {
  if (c.normies.have < 1) return []
  const out: string[] = []
  const pct = (b: number) => `+${Math.round(b * 100)}%`
  const px = c.pixel
  if (px.floor) {
    out.push(
      px.floor.spare === 0
        ? `You are exactly on the ${pct(px.now)} boost line (${px.floor.at} #PIXEL). Selling or spending even 1 drops you to ${px.floor.dropsTo === 0 ? "no boost" : `${pct(px.floor.dropsTo)} boost`}.`
        : `You can sell or move up to ${px.floor.spare} #PIXEL and keep your ${pct(px.now)} boost. One more than that drops you to ${px.floor.dropsTo === 0 ? "no boost" : `${pct(px.floor.dropsTo)} boost`}.`,
    )
  } else if (px.next) {
    out.push(`You have no boost yet. It starts at ${px.next.at} #PIXEL (${pct(px.next.value)}), ${px.next.needMore} away.`)
  }
  if (px.next && px.floor) out.push(`${px.next.needMore} more #PIXEL (${px.next.at} in all) lifts you to ${pct(px.next.value)}.`)
  const n = c.normies
  if (n.floor && n.floor.dropsTo !== 0 && n.floor.spare === 0) {
    out.push(`You hold exactly ${n.floor.at} Normies, the line for the ${num(n.now)}x multiplier. Selling or burning one drops your whole stack to ${num(n.floor.dropsTo)}x.`)
  }
  if (n.next) out.push(`${n.next.needMore} more Normie${n.next.needMore === 1 ? "" : "s"} (${n.next.at} in all) lifts your whole stack to ${num(n.next.value)}x.`)
  out.push("#PIXEL you have listed for sale still counts until it sells. Holdings are sampled at four random blocks a day, so what counts is what you hold at those moments.")
  return out
}

const ethText = (n: number) => String(Number(n.toFixed(5)))

/** Burning versus buying at the best ask, per #PIXEL, in plain words. Null without a live ask. */
function vsAskText(v: string | undefined, ask: number | null): string | null {
  if (!v || ask === null) return null
  if (v === "market-cheaper") return `below the ask (${ethText(ask)}): buying #PIXEL is cheaper`
  if (v === "burn-cheaper") return `above the ask (${ethText(ask)}): burning is cheaper`
  return `the ask (${ethText(ask)}) is inside the burn's range`
}

function breakEvenText(b: { low: number; mid: number; high: number } | undefined): string | null {
  if (!b) return null
  return b.low === b.high ? `${ethText(b.mid)} ETH` : `${ethText(b.low)} to ${ethText(b.high)} ETH`
}

/** One line of live numbers. Always a snapshot; the market is new and thin. */
export function marketLineText(m: PixelMarketSnapshot | null): string | null {
  if (!m) return null
  const parts: string[] = []
  parts.push(m.bestAskEth !== null ? `best ask ${ethText(m.bestAskEth)} ETH per #PIXEL` : "nothing listed right now")
  if (m.lastPriceEth !== null) parts.push(`last fill ${ethText(m.lastPriceEth)}`)
  parts.push(`${m.pixelsListed.toLocaleString("en-US")} #PIXEL listed in ${m.activeListings} listing${m.activeListings === 1 ? "" : "s"}`)
  parts.push(`24h volume ${ethText(m.volume24hEth)} ETH (${m.pixels24h} #PIXEL)`)
  return `Pixel Market now: ${parts.join(" · ")}. A snapshot of a new, thin market: it can move in minutes.${m.paused ? " The market is paused right now." : ""}`
}

/** What reaching the next boost would cost off the book today, and the labelled illustrative payback. */
export function cliffCostSentences(c: CliffCost | null): string[] {
  if (!c) return []
  const out: string[] = []
  const b = c.buy
  if (b.shortfall > 0) {
    out.push(`The book is too thin to fill the next boost (+${c.boostPct}% at ${c.atPixel} #PIXEL): only ${b.filled} of the ${c.needMore} you need are listed.`)
    return out
  }
  out.push(`Reaching ${c.atPixel} #PIXEL (+${c.boostPct}% boost) means buying ${c.needMore} more: about ${ethText(b.costEth)} ETH off the book today (average ${ethText(b.avgEth ?? 0)}, dearest ${ethText(b.worstEth ?? 0)}; the price rises as you buy${b.approx ? ", and some listings must be bought whole, so it can run a little higher" : ""}). Your score would go ${num(c.scoreBefore)} to ${num(c.scoreAfter)} (+${num(c.scoreGain)}), about ${ethText(c.costPerScorePoint ?? 0)} ETH per point.`)
  if (c.payback.length > 0) {
    const bits = c.payback.map((p) => `${num(p.poolEthPerMonth)} ETH a month: ${ethText(p.monthlyEth)} ETH a month for you, ${p.months === null ? "no payback" : `${num(p.months)} months to earn it back`}`)
    out.push(`If the monthly holder pool were (illustrative scenarios built on the Sep 23 article's pace, NOT forecasts; the real pool depends on volume nobody knows yet): ${bits.join("; ")}.`)
  }
  return out
}

/** The one sentence at the top of the Sell view. */
function sellHeadline(pixel: number, floor: { at: number; spare: number; dropsTo: number } | null, rows: SellRow[], book: PixelMarketSnapshot | null, market: MarketState): string {
  if (pixel === 0) return "You hold no #PIXEL, so there is nothing to sell."
  if (market !== "live") return "The Pixel Market is not open yet, so there is nothing to sell into."
  if (!book || rows.length === 0) return "The order book could not be read this time, so we cannot price a sale. Try again in a minute."
  const cushion = rows[0]
  const keeps = floor && cushion.pixels === floor.spare && floor.spare < pixel
  if (floor && floor.spare === 0) return `You are exactly on a boost line, so selling even 1 #PIXEL drops your boost. At the best ask, all ${pixel} #PIXEL would net about ${ethText(rows[0].netEth)} ETH after the 10% fee.`
  return keeps
    ? `You can sell up to ${cushion.pixels} #PIXEL and keep your boost: about ${ethText(cushion.netEth)} ETH at ${cushion.label.split(" at ")[1]} after the 10% fee.`
    : `Selling ${cushion.pixels} #PIXEL would net about ${ethText(cushion.netEth)} ETH at ${cushion.label.split(" at ")[1]} after the 10% fee.`
}

/** The rows of the Sell view, at reference prices only. */
function buildSellView(rows: SellRow[], pixel: number, book: PixelMarketSnapshot | null): PageModel["sellView"] {
  if (pixel === 0 || !book || rows.length === 0) return null
  return {
    rows: rows.map((r) => ({
      label: `Sell ${r.pixels} #PIXEL (${r.label})`,
      net: `${ethText(r.netEth)} ETH net`,
      detail: `${ethText(r.priceEth)} ETH each = ${ethText(r.grossEth)} gross, minus the 10% fee ${ethText(r.feeEth)}. ${r.ahead.toLocaleString("en-US")} #PIXEL are listed at or below that price, so they sell first. Your score would be ${num(r.scoreAfter)} (pool share ${r.sharePctAfter}%).`,
    })),
    notes: ["Reference prices, not advice on where to list. You set your own price; nothing here predicts it will sell."],
  }
}

const pctText = (n: number) => String(Number(n.toFixed(4)))

/**
 * "How your score adds up" and the nearest step up, from the same numbers the advice used.
 * A step up assumes the extra Normies or #PIXEL arrive with no other change, so real gains can only be higher
 * (new Normies usually carry some #PIXEL of their own).
 */
export function scoreBreakdown(advice: { held: number; pixel: number; score: number; othersScore: number; sharePct: number; nextBracket: { atHeld: number; needMore: number } | null; nextBoost: { atPixel: number; needMore: number } | null }): { ledger: LedgerRow[]; nextSteps: NextStep[] } {
  const { held, pixel, score, othersScore } = advice
  if (held < 1) return { ledger: [], nextSteps: [] }
  const mult = bracketMultiplier(held)
  const boost = boostFor(pixel)
  const ledger: LedgerRow[] = [
    { label: `Normies (${held} at ${num(mult)}x)`, value: num(held * mult) },
    { label: `#PIXEL (${pixel}, 5 counts as 1 Normie)`, value: num(pixel / 5) },
    { label: "Boost from #PIXEL", value: `+${Math.round(boost * 100)}%` },
    { label: "Your score", value: num(score), strong: true },
    { label: "Everyone else", value: Math.round(othersScore).toLocaleString("en-US") },
    { label: "Your share", value: `${advice.sharePct}%`, strong: true },
  ]
  const shareOf = (s: number) => (s / Math.max(1e-9, othersScore + s)) * 100
  const step = (title: string, after: number): NextStep => ({
    title,
    detail: `Score ${num(score)} to ${num(after)} (+${num(after - score)}), share ${advice.sharePct}% to ${pctText(shareOf(after))}. At least this much: anything you add usually brings #PIXEL of its own.`,
  })
  const nextSteps: NextStep[] = []
  if (advice.nextBracket) {
    const { atHeld, needMore } = advice.nextBracket
    nextSteps.push(step(`${needMore} more Normie${needMore === 1 ? "" : "s"} (${atHeld} in all) for a ${num(bracketMultiplier(atHeld))}x multiplier`, walletScore(atHeld, pixel)))
  }
  if (advice.nextBoost) {
    const { atPixel, needMore } = advice.nextBoost
    nextSteps.push(step(`${needMore} more #PIXEL (${atPixel} in all) for a +${Math.round(boostFor(atPixel) * 100)}% boost`, walletScore(held, atPixel)))
  }
  return { ledger, nextSteps }
}
