// lib/agent-recommendations/tierMath.ts
// "Should I buy X to reach tier Y?" — advise without advising.
// Shows the before/after revenue-share SCORE for a named holding, what is unknown,
// and how many wallets sit in the target cell today. Never a verdict, never ETH/USD,
// never a payout, earnings or price figure (AGENTS.md: numbers yes, promises never).

import {
  BOOST_CLIFFS,
  BRACKET_CLIFFS,
  boostFor,
  bracketMultiplier,
  walletScore,
} from "../burn-buy/score"

/** Where the tier tables and wallet spread come from, and when they were read. */
export const REVENUE_SHARE_SOURCE = {
  label: "normies.art Revenue Share tab",
  url: "https://www.normies.art",
  post: "https://x.com/normiesART/status/2116953901417046511",
  asOf: "2026-11-02 07:26 Guam (2026-11-01 21:26 UTC)",
  asOfIso: "2026-11-01T21:26:00Z",
} as const

/** Holding wallets on the tab at REVENUE_SHARE_SOURCE.asOf. */
export const HOLDING_WALLETS = 1665

/**
 * Wallet spread from the tab. The tab only splits #PIXEL at 15, so `pixel15Plus`
 * holds every boost tier (15+, 100+, 500+, 1,500+).
 */
export const WALLET_SPREAD: ReadonlyArray<{
  label: string
  minHeld: number
  maxHeld: number
  under15: number
  pixel15Plus: number
}> = [
  { label: "1", minHeld: 1, maxHeld: 1, under15: 1041, pixel15Plus: 18 },
  { label: "2-4", minHeld: 2, maxHeld: 4, under15: 338, pixel15Plus: 37 },
  { label: "5-9", minHeld: 5, maxHeld: 9, under15: 84, pixel15Plus: 13 },
  { label: "10-24", minHeld: 10, maxHeld: 24, under15: 50, pixel15Plus: 8 },
  { label: "25-49", minHeld: 25, maxHeld: 49, under15: 13, pixel15Plus: 2 },
  { label: "50+", minHeld: 50, maxHeld: Number.POSITIVE_INFINITY, under15: 1, pixel15Plus: 4 },
]

export type Holding = { held: number; pixel: number }

export type TierQuestion = {
  before: Holding
  after: Holding
  /** Which side crosses a step: the #PIXEL boost or the Normies bracket. */
  crosses: "pixel" | "normies"
  threshold: number
}

export type TierMathResult = TierQuestion & {
  scoreBefore: number
  scoreAfter: number
  multBefore: number
  multAfter: number
  pctMoreScore: number
  /** Wallets in the target cell today, with the cell label. Null when held is 0. */
  walletsInCell: { count: number; cell: string } | null
  line: string
}

const INTENT =
  /\b(buy|buying|get|getting|add|adding|grab|pick up|reach|reaching|cross|crossing|hit|hitting|worth|bump|move up|next)\b/i
const TIER_WORD = /\b(tier|bracket|boost|step|threshold|cliff|reach|cross|hit|to \d)/i

function num(s: string | undefined): number | null {
  if (s == null) return null
  const n = Number(s.replace(/,/g, ""))
  return Number.isFinite(n) && n >= 0 && n < 1_000_000 ? n : null
}

const PIXEL_UNIT = String.raw`(?:#?pixels?|px|ap|action points?)`
const NORMIE_UNIT = String.raw`(?:normies?|nfts?)`

/** Quick check: is this a "buy / add to reach a tier" question? */
export function isTierQuestion(query: string): boolean {
  const q = query || ""
  if (!INTENT.test(q) || !TIER_WORD.test(q)) return false
  return new RegExp(PIXEL_UNIT, "i").test(q) || new RegExp(NORMIE_UNIT, "i").test(q)
}

function nextStep(cliffs: readonly number[], current: number): number | null {
  for (const c of cliffs) if (current < c) return c
  return null
}

/**
 * Parse a holding and a target out of free text, e.g.
 * "I have 1 Normie and 14 #PIXEL, is it worth buying 1 more to reach 15?"
 * Returns null when the holding is not stated — the model then asks for it.
 */
export function parseTierQuestion(
  query: string,
  fallbackHeld?: number | null,
): TierQuestion | null {
  const q = (query || "").replace(/#(\d{1,5})\b(?!\s*(?:pixel|px|ap))/gi, " ") // drop token IDs like #7141
  if (!isTierQuestion(query)) return null

  const heldMatch = new RegExp(String.raw`(\d[\d,]*)\s*${NORMIE_UNIT}\b`, "i").exec(q)
  const pixelMatch = new RegExp(String.raw`(\d[\d,]*)\s*${PIXEL_UNIT}\b`, "i").exec(q)
  const held = num(heldMatch?.[1]) ?? (fallbackHeld != null && fallbackHeld > 0 ? fallbackHeld : null)
  const pixel = num(pixelMatch?.[1]) ?? 0
  if (held == null || held < 1) return null

  const target = num(/\b(?:reach|cross|hit|get to|to)\s+(\d[\d,]*)/i.exec(q)?.[1])
  const more = num(/\b(?:buy|buying|get|getting|add|adding|grab)\s+(\d[\d,]*)\s+more\b/i.exec(q)?.[1])
  const asksNormies =
    /\b(?:more|another|extra|\d+\s+more)\s+normies?\b/i.test(q) ||
    /\b(?:bracket)\b/i.test(q)

  if (asksNormies) {
    const t = target ?? (more != null ? held + more : nextStep(BRACKET_CLIFFS, held))
    if (t == null || t <= held) return null
    return { before: { held, pixel }, after: { held: t, pixel }, crosses: "normies", threshold: t }
  }

  let t = target ?? (more != null ? pixel + more : nextStep(BOOST_CLIFFS, pixel))
  if (t == null) return null
  // "buy 1 more to reach 15" with no stated #PIXEL: assume they sit one below the target.
  if (!pixelMatch && target != null && more != null) {
    return {
      before: { held, pixel: Math.max(0, target - more) },
      after: { held, pixel: target },
      crosses: "pixel",
      threshold: target,
    }
  }
  if (t <= pixel) return null
  return { before: { held, pixel }, after: { held, pixel: t }, crosses: "pixel", threshold: t }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function fmtMult(n: number): string {
  return `x${n.toFixed(2)}`
}

/** Combined cell multiplier: bracket x (1 + boost). */
export function cellMultiplier(h: Holding): number {
  return bracketMultiplier(h.held) * (1 + boostFor(h.pixel))
}

export function walletsInCell(h: Holding): { count: number; cell: string } | null {
  if (h.held < 1) return null
  const row = WALLET_SPREAD.find((r) => h.held >= r.minHeld && h.held <= r.maxHeld)
  if (!row) return null
  const plus = h.pixel >= 15
  const normies = row.label === "1" ? "one-Normie" : `${row.label} Normies`
  return {
    count: plus ? row.pixel15Plus : row.under15,
    cell: `${normies}, ${plus ? "15+ #PIXEL" : "under 15 #PIXEL"}`,
  }
}

function describeHolding(h: Holding): string {
  return h.held === 1 ? "a one-Normie wallet" : `a ${h.held}-Normie wallet`
}

/** The labelled facts line Ask injects for a tier question. No verdict, no ETH. */
export function formatTierMath(tq: TierQuestion): TierMathResult {
  const scoreBefore = walletScore(tq.before.held, tq.before.pixel)
  const scoreAfter = walletScore(tq.after.held, tq.after.pixel)
  const multBefore = cellMultiplier(tq.before)
  const multAfter = cellMultiplier(tq.after)
  const pctMoreScore = scoreBefore > 0 ? Math.round(((scoreAfter - scoreBefore) / scoreBefore) * 100) : 0
  const cell = walletsInCell(tq.after)

  const what =
    tq.crosses === "pixel"
      ? `Going from ${tq.before.pixel} to ${tq.after.pixel} #PIXEL takes ${describeHolding(tq.before)}`
      : `Going from ${tq.before.held} to ${tq.after.held} Normies (at ${tq.before.pixel} #PIXEL) takes the wallet`

  const step =
    multAfter === multBefore
      ? `stays at ${fmtMult(multBefore)} (no tier step crossed), ${pctMoreScore}% more score from the extra points alone (${round1(scoreBefore)} to ${round1(scoreAfter)})`
      : `from ${fmtMult(multBefore)} to ${fmtMult(multAfter)}, about ${pctMoreScore}% more score (${round1(scoreBefore)} to ${round1(scoreAfter)})`

  const parts = [
    `${what} ${step}.`,
    "Your payout depends on every other wallet's score and the pool size, which can't be known in advance, so we can't say what that's worth in ETH.",
  ]
  if (cell) {
    parts.push(
      `${cell.count} of ${HOLDING_WALLETS.toLocaleString("en-US")} holding wallets are in that spot today (${cell.cell}; ${REVENUE_SHARE_SOURCE.label}, ${REVENUE_SHARE_SOURCE.asOf}). Don't take our word for it: check the tab.`,
    )
  }
  parts.push("Not financial advice, and values can go up or down. See /burn for a vibe check.")

  return {
    ...tq,
    scoreBefore,
    scoreAfter,
    multBefore,
    multAfter,
    pctMoreScore,
    walletsInCell: cell,
    line: parts.join(" "),
  }
}

/**
 * Words and figures a tier answer must never contain: a verdict, a price, or an
 * ETH / USD payout or earnings projection. Used by the Ask tests to keep tier answers clean.
 */
export const TIER_ANSWER_FORBIDDEN: ReadonlyArray<{ name: string; re: RegExp }> = [
  { name: "verdict: worth it", re: /\b(?:is|it's|its|definitely|probably|totally)\s+(?:not\s+)?worth\s+it\b/i },
  { name: "verdict: (don't) do it", re: /\b(?:do it|don't do it|go for it|pull the trigger|skip it)\b/i },
  { name: "verdict: should / recommend", re: /\b(?:you should|i'd|i would|we recommend|i recommend|recommended|my advice)\b/i },
  { name: "verdict: buy / sell / hold call", re: /\b(?:buy now|sell now|good buy|bad buy|good deal|no[- ]brainer|easy win|smart move|must[- ]buy|great value)\b/i },
  { name: "price prediction", re: /\b(?:will (?:go up|rise|pump|moon|increase|drop|fall)|price target|going to (?:go up|moon|pump))\b/i },
  { name: "ETH amount", re: /(?:Ξ\s*\d|\b\d+(?:\.\d+)?\s*eth\b)/i },
  { name: "USD amount", re: /\$\s*\d/ },
  { name: "earnings projection", re: /\b(?:you(?:'ll| will)\s+(?:earn|make|get paid)|per month|a month|monthly|per year|a year|annual(?:ly)?|apr|apy|roi|guaranteed)\b/i },
]

export function findTierAnswerViolations(text: string): string[] {
  return TIER_ANSWER_FORBIDDEN.filter((f) => f.re.test(text || "")).map((f) => f.name)
}
