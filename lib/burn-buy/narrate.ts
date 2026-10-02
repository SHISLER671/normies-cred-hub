// Turns a BurnBuyResult into plain sentences for the /burn page. Pure: no I/O, no React.
// Rule: every number shown here is copied from the result, never recomputed, so the page cannot disagree with the API.

import type { Move, Verdict } from "./advise"
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
}

export interface PageModel {
  state: PageState
  /** The one-sentence answer. */
  headline: string
  /** Short plain sentences under the headline. */
  lines: string[]
  rows: TokenRow[]
  moves: MoveLine[]
  fodder: Array<{ tokenId: number; priceEth: number; pays: number; perEth: number; url: string | null }>
  /** Where to go if this wallet is only a Canvas delegate. */
  delegateOf: Array<{ tokenId: number; owner: string }>
  goal: Goal
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

export function describeMove(m: Move): MoveLine {
  const score = `Your score goes ${num(m.scoreBefore)} → ${num(m.scoreAfter)} (+${num(m.scoreGain)}). Your share of the pool: ${m.shareBeforePct}% → ${m.shareAfterPct}%.`
  if (m.kind === "burn-own") {
    return {
      title: `Burn ${ids(m.tokenIds)} into the one(s) you keep`,
      detail: `Permanent. You give up about ${eth(m.costEth)} of sale value. ${score}`,
    }
  }
  if (m.kind === "buy-and-burn") {
    return {
      title: `Buy ${ids(m.tokenIds)} for ${eth(m.costEth)}, then burn ${m.tokenIds.length > 1 ? "them" : "it"} into a Normie you hold`,
      detail: `Its #PIXEL and any AP it carries move to you. ${score}`,
    }
  }
  return {
    title: `Buy ${ids(m.tokenIds)} for ${eth(m.costEth)} and keep ${m.tokenIds.length > 1 ? "them" : "it"}`,
    detail: `One more Normie in your stack. ${score}`,
  }
}

const ARENA_NOTES = [
  "Arena is not open from this page, and this page cannot enter you into anything.",
  "Official design (@serc1n, Sep 18): autonomous agents on a 640×640 continent, no human players. Five camps: Human, Cat, Alien, Agent, Zombie. Type, Level and on-chain history matter.",
  "Level = floor(AP ÷ 10) + 1. Burning another Normie into one you keep adds AP to it, so it can raise its Level.",
  "The combat rules have NOT been published. Nobody can honestly tell you how many Normies to keep or what Level wins. Anyone who says they can is guessing, and so would we.",
  "If an agent dies in a round it waits for the next round and respawns. Death is not a burn. A burn is permanent.",
  "Whether a Normie must be awakened to enter, and when entry opens, is not published here. Check @normiesART.",
]

const ART_NOTES = [
  "In the official editor, every #PIXEL is one pixel you can add or remove on a Normie you keep. Edits are written on-chain and stay.",
  "If you have already drawn on a Normie, burning it erases that art for good. Burn yield is paid on the ORIGINAL pixel count, not your edited art.",
  "Pixel counts of rare Normies are a style choice as much as a number. If one means something to you, keep it.",
]

function fodderLine(f: PageModel["fodder"][number], goal: Goal, keeperAp: number | null): MoveLine {
  const base = `Buy #${f.tokenId} for ${eth(f.priceEth)} and burn it into a Normie you keep`
  if (goal === "arena") {
    const lvl = keeperAp === null
      ? `That is about +${num(f.pays / 10)} Levels (10 AP per Level).`
      : `Level ${levelOf(keeperAp)} → ${levelOf(keeperAp + f.pays)}.`
    return { title: base, detail: `Adds ${f.pays} AP to it. ${lvl}` }
  }
  return { title: base, detail: `Gives you ${f.pays} pixels of edit budget (${f.perEth} per ETH).` }
}

export function buildPageModel(result: BurnBuyResult | null, goal: Goal = "share"): PageModel {
  const goalNotes = goal === "arena" ? ARENA_NOTES : goal === "art" ? ART_NOTES : []
  const base: PageModel = { state: "no-wallet", headline: "Paste a wallet to get your answer.", lines: [], rows: [], moves: [], fodder: [], delegateOf: [], goal, goalNotes }
  if (!result) return base

  const fodder = (result.market?.bestPixelFodder ?? []).slice(0, 5).map((f) => ({
    tokenId: f.tokenId,
    priceEth: f.priceEth,
    pays: f.yieldTotal,
    perEth: f.yieldPerEth,
    url: safeUrl(f.url),
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
      moves: goal === "share" ? advice.moves.slice(0, 3).map(describeMove) : [],
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
      if (verdict === "burn") reasons = [`burning adds ${t.yield.total} AP to a Normie you keep (10 AP = 1 Level)`]
    }
    if (goal === "art" && verdict === "burn") {
      reasons = [`burning gives you ${t.yield.total} pixels of edit budget for a Normie you keep. If you have drawn on it, that art is lost`]
    }
    return {
      tokenId: t.tokenId,
      verdict,
      label: LABEL[verdict],
      reasons,
      pays: t.yield.total > 0
        ? goal === "art"
          ? `Burning would give ${t.yield.total} pixels of edit budget.`
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
  const spareYield = advice.tokens.filter((t) => burnRows.some((r) => r.tokenId === t.tokenId)).reduce((s, t) => s + t.yield.total, 0)
  const lone = keepN === 1 ? holdings.get(keepRows[0].tokenId) : undefined
  const keeperAp = lone ? lone.actionPoints : null

  const lines: string[] = [
    `You hold ${advice.held} Normie${advice.held === 1 ? "" : "s"} and ${advice.pixel} #PIXEL. Score ${num(advice.score)}, ${advice.sharePct}% of the pool.`,
  ]
  if (burnN === 0) lines.push(`Nothing here is a burn candidate: ${keepN} to keep${eitherN > 0 ? `, ${eitherN} either way` : ""}.`)
  else lines.push(`${burnN} burn candidate${burnN === 1 ? "" : "s"}, ${keepN} to keep${eitherN > 0 ? `, ${eitherN} either way` : ""}. A candidate is only "nothing says keep and it pays something", not an order.`)
  if (burnN > 0 && burnN >= advice.held && advice.held > 1) {
    lines.push(`Burning needs a Normie left to receive it, so at most ${advice.held - 1} of these ${advice.held} can go.`)
  }
  if (goal === "share") {
    if (advice.nextBracket) lines.push(`${advice.nextBracket.needMore} more Normie${advice.nextBracket.needMore === 1 ? "" : "s"} lifts your whole stack to the next bracket (at ${advice.nextBracket.atHeld}).`)
    if (advice.nextBoost) lines.push(`${advice.nextBoost.needMore} more #PIXEL reaches the next boost (at ${advice.nextBoost.atPixel}).`)
    lines.push(...advice.notes)
  } else if (goal === "arena") {
    if (lone) lines.push(`Your Arena Normie is #${lone.tokenId}${lone.type ? ` (${lone.type})` : ""}: Level ${levelOf(lone.actionPoints)} with ${lone.actionPoints} AP.`)
    else if (keepN > 1) lines.push(`Your fighters: ${keepRows.map((r) => `#${r.tokenId}${r.type ? ` ${r.type}` : ""} (Level ${r.level})`).join(", ")}.`)
  } else {
    lines.push("Every #PIXEL you receive is one pixel you can add or remove on a Normie you keep.")
  }

  let headline: string
  let moves: MoveLine[]
  if (goal === "share") {
    const best = advice.moves[0]
    headline = best ? `Best move right now: ${describeMove(best).title}.` : "Nothing to do right now: no move improves your score."
    moves = advice.moves.slice(0, 3).map(describeMove)
  } else {
    const picks = fodder.slice(0, 3).map((f) => fodderLine(f, goal, keeperAp))
    moves = picks
    if (goal === "arena") {
      headline = advice.held === 1
        ? "Keep it. It is your only Normie, so it is your only player."
        : burnN === 0
          ? "Arena plan: keep everything you hold. Nothing here is spare."
          : `Arena plan: keep ${keepN} fighter${keepN === 1 ? "" : "s"}. ${burnN} spare Normie${burnN === 1 ? "" : "s"} could be burned for +${spareYield} AP, only if you want the Level.`
    } else {
      headline = advice.held === 1
        ? "Keep it. To get pixels to draw with, you burn another Normie into it, for example one you buy (see below)."
        : burnN === 0
          ? "Art plan: keep what you hold. Nothing here is spare to burn."
          : `Art plan: burning your ${burnN} spare Normie${burnN === 1 ? "" : "s"} gives ${spareYield} pixels to draw with on the ones you keep.`
    }
  }

  return { state: "holds", headline, lines, rows, moves, fodder, delegateOf: [], goal, goalNotes }
}
