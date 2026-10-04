// Turns a BurnBuyResult into plain sentences for the /burn page. Pure: no I/O, no React.
// Rule: every number shown here is copied from the result, never recomputed, so the page cannot disagree with the API.

import type { Move, Verdict } from "./advise"
import type { JevVerdict } from "./jev"
import { BOOSTS, BRACKETS, boostFor, bracketMultiplier, walletScore, type MarketState, type YieldMode } from "./score"
import type { BurnBuyResult } from "./service"

export type PageState = "no-wallet" | "empty" | "delegate-only" | "holds"

/** What the holder is burning FOR. Same data, different answer. */
export type Goal = "share" | "arena" | "art"
export const GOALS: ReadonlyArray<{ id: Goal; label: string; blurb: string }> = [
  { id: "share", label: "Revenue share", blurb: "Grow your score and your slice of the pool." },
  { id: "arena", label: "Arena", blurb: "Protect the Normies you want to play with." },
  { id: "art", label: "Art", blurb: "Earn pixels to draw on the Normies you keep." },
]
export const parseGoal = (v: string | null | undefined): Goal => (v === "arena" || v === "art" ? v : "share")

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
  fodder: Array<{ tokenId: number; priceEth: number; pays: number; perEth: number; url: string | null; /** Normal burn mode only: the full range one burn could pay. */ range: { min: number; max: number } | null }>
  /** A link to the normies.art revenue share simulator, pre-filled with this wallet's Normies and #PIXEL. Share goal only. */
  simulatorUrl: string | null
  /** How a burn pays ("normal" means a roll, so figures are shown as about / ~ with a range). */
  yieldMode: YieldMode
  /** Whether Pixel Market is open. */
  marketState: MarketState
  /** Where to go if this wallet is only a Canvas delegate. */
  delegateOf: Array<{ tokenId: number; owner: string }>
  /** Warnings that must stay visible (for example: you cannot burn them all). Also present in `lines`. */
  notices: string[]
  goal: Goal
  /** "How your score adds up", line by line. Revenue share goal with Normies only; otherwise empty. */
  ledger: LedgerRow[]
  /** What the nearest multiplier or boost step would do to the score. Revenue share goal only; otherwise empty. */
  nextSteps: NextStep[]
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

const NOTICE_OPEN = "The 4% rate ends by 8 PM Central European time on Monday, October 5 (18:00 UTC), and may close 1 to 2 hours earlier. After that, burns go back to the normal 1 to 4% range."
const NOTICE_MAYBE_CLOSED = "The 4% rate may already have ended: it was announced to close between about 6 and 8 PM Central European time (16:00 to 18:00 UTC) on Monday. Figures here use the normal roll. Check normies.art before you burn."
const NOTICE_PINNED_PAST = "This page is still showing the 4% rate because the site owner has pinned it, but the announced end has passed. Check normies.art before you burn."
const NOTICE_ENDED = "The 4% rate has ended (it was announced to close on Monday, October 5). Figures here use the normal roll."
const ENDED_NOTICE_MS = 72 * 3600 * 1000

/** The one sentence about the 4% window that fits the moment, or null. Uses the result's own clock. */
export function promoNotice(r: Pick<BurnBuyResult, "yieldMode" | "asOf"> & { promo: { window?: { state: string; latestEnd: string } } }): string | null {
  const w = r.promo.window
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
    return {
      title: `Burn ${ids(m.tokenIds)} into the one(s) you keep`,
      detail: `Permanent. You give up about ${eth(m.costEth)} of sale value. ${score}${roll}`,
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
  const goalNotes = goal === "arena" ? ARENA_NOTES : goal === "art" ? ART_NOTES : SHARE_NOTES
  const yieldMode: YieldMode = result?.yieldMode ?? "promo"
  const marketState: MarketState = result?.marketState ?? "pending"
  const base: PageModel = { simulatorUrl: null, yieldMode, marketState, state: "no-wallet", headline: "Paste a wallet to get your answer.", lines: [], rows: [], moves: [], fodder: [], delegateOf: [], notices: [], goal, goalNotes, ledger: [], nextSteps: [] }
  if (!result) return base

  const fodder = (result.market?.bestPixelFodder ?? []).slice(0, 5).map((f) => ({
    tokenId: f.tokenId,
    priceEth: f.priceEth,
    pays: f.yieldTotal,
    perEth: f.yieldPerEth,
    url: safeUrl(f.url),
    range: f.yieldMin !== undefined && f.yieldMax !== undefined ? { min: f.yieldMin, max: f.yieldMax } : null,
  }))

  const w = result.wallet
  if (!w) return { ...base, fodder }

  const { advice } = w
  if (advice.held === 0) {
    if (w.delegateOf.length > 0) {
      return {
        ...base,
        state: "delegate-only",
        headline: "This wallet can edit pixels on a Normie, but it cannot burn it.",
        lines: [
          `It is a Canvas delegate for ${ids(w.delegateOf.map((d) => d.tokenId))}. Burn advice needs the OWNER wallet.`,
          "Paste the owner wallet below to see what to burn and what to keep.",
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
  const windowNotice = promoNotice(result)
  if (windowNotice) notices.push(windowNotice)
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
  } else {
    lines.push("Pixels on a Normie are its paint budget: they set how many pixels of its face you can change. Painting never uses them up.")
  }

  let headline: string
  let moves: MoveLine[]
  if (goal === "share") {
    const best = advice.moves[0]
    headline = best ? `Best move right now: ${describeMove(best, yieldMode).title}.` : "Nothing to do right now: no move improves your score."
    moves = advice.moves.slice(0, 3).map((m) => describeMove(m, yieldMode))
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
  return { state: "holds", simulatorUrl: goal === "share" && advice.held >= 1 ? simulatorUrl(advice.held, advice.pixel) : null, yieldMode, marketState, headline, lines, rows, moves, fodder, delegateOf: [], notices, goal, goalNotes, ledger, nextSteps }
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
