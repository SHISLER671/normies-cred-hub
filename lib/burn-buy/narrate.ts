// Turns a BurnBuyResult into plain sentences for the /burn page. Pure: no I/O, no React.
// Rule: every number shown here is copied from the result, never recomputed, so the page cannot disagree with the API.

import type { Move, Verdict } from "./advise"
import type { BurnBuyResult } from "./service"

export type PageState = "no-wallet" | "empty" | "delegate-only" | "holds"

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

export function buildPageModel(result: BurnBuyResult | null): PageModel {
  const base: PageModel = { state: "no-wallet", headline: "Paste a wallet to get your answer.", lines: [], rows: [], moves: [], fodder: [], delegateOf: [] }
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
      moves: advice.moves.slice(0, 3).map(describeMove),
      fodder,
    }
  }

  const holdings = new Map(advice.holdings.map((h) => [h.tokenId, h]))
  const rows: TokenRow[] = advice.tokens.map((t) => ({
    tokenId: t.tokenId,
    verdict: t.verdict,
    label: LABEL[t.verdict],
    reasons: t.reasons,
    pays: t.yield.total > 0
      ? `Burning would pay ${t.yield.total} #PIXEL (${t.yield.fromPixels} from pixels${t.yield.transferred > 0 ? `, ${t.yield.transferred} AP carried over` : ""}).`
      : "Burning would pay nothing.",
    originalPixels: holdings.get(t.tokenId)?.originalPixels ?? null,
    actionPoints: holdings.get(t.tokenId)?.actionPoints ?? null,
  }))

  const burnN = rows.filter((r) => r.verdict === "burn").length
  const keepN = rows.filter((r) => r.verdict === "keep").length
  const best = advice.moves[0]

  const lines: string[] = [
    `You hold ${advice.held} Normie${advice.held === 1 ? "" : "s"} and ${advice.pixel} #PIXEL. Score ${num(advice.score)}, ${advice.sharePct}% of the pool.`,
    burnN === 0
      ? `Nothing here is a burn candidate: ${keepN} to keep${rows.length - keepN > 0 ? `, ${rows.length - keepN} either way` : ""}.`
      : `${burnN} burn candidate${burnN === 1 ? "" : "s"}, ${keepN} to keep${rows.length - burnN - keepN > 0 ? `, ${rows.length - burnN - keepN} either way` : ""}. A candidate is only "nothing says keep and it pays something", not an order.`,
  ]
  if (burnN > 0 && burnN >= advice.held) {
    lines.push(
      advice.held === 1
        ? "This is your only Normie: burning it would leave you nothing to burn into and end your membership."
        : `Burning needs a Normie left to receive it, so at most ${advice.held - 1} of these ${advice.held} can go.`,
    )
  }
  if (advice.nextBracket) lines.push(`${advice.nextBracket.needMore} more Normie${advice.nextBracket.needMore === 1 ? "" : "s"} lifts your whole stack to the next bracket (at ${advice.nextBracket.atHeld}).`)
  if (advice.nextBoost) lines.push(`${advice.nextBoost.needMore} more #PIXEL reaches the next boost (at ${advice.nextBoost.atPixel}).`)
  lines.push(...advice.notes)

  const headline = best
    ? `Best move right now: ${describeMove(best).title}.`
    : "Nothing to do right now: no move improves your score."

  return { state: "holds", headline, lines, rows, moves: advice.moves.slice(0, 3).map(describeMove), fodder, delegateOf: [] }
}
