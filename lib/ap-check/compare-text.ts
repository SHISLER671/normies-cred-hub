// Market-or-burn compare, as plain facts (moved under /burn on 2026-11-10: AGENTS.md fences buy-vs-burn views to /burn).
// Pure: no I/O. The page and /api/burn/ap-check both use it, so the wording is the same everywhere.
//
// Neutral framing on purpose: two routes, two costs, with a source and an as-of time. Never "X is cheaper", "wins",
// "better" or "you should". The holder decides.

import type { BudgetAnswer, PixelsAnswer } from "./buy-smart"

/** "500", "500 pixels", "0.5", "0.5 eth", "1,000" -> a positive number, or null. */
export function parseCalcAmount(raw: string | null | undefined, mode: "pixels" | "eth"): number | null {
  if (!raw) return null
  const s = raw.trim().toLowerCase().replace(/,/g, "").replace(/\s*(pixels?|px|eth|ξ)$/, "")
  if (!/^\d*\.?\d+$/.test(s)) return null
  const n = Number(s)
  if (!(n > 0)) return null
  if (mode === "pixels") return Number.isInteger(n) && n <= 1_000_000 ? n : null
  return n <= 1_000 ? n : null
}

const ethNum = (n: number) => n.toFixed(n < 0.1 ? 4 : 3).replace(/0+$/, "").replace(/\.$/, "")
export const ethText = (n: number) => `${ethNum(n)} ETH`
const utc = (iso: string) => iso.slice(0, 16).replace("T", " ") + " UTC"

export const COMPARE_SOURCES =
  "Pixel Market order book: api.normies.art /market/depth. Floor listings: OpenSea, with each Normie's attached pixels re-read from the chain. Burn rolls: the Normies contract tiers (original Pixel Count)."

export const COMPARE_FINE_PRINT = [
  "Not financial advice.",
  "Values can go up or down, and no one knows the future.",
  "Don't take our word for it: check the order book and the listings yourself before you do anything.",
] as const

/** One neutral line per route, plus an as-of line. No verdict words. */
export function compareLines(a: PixelsAnswer | BudgetAnswer, asOf: string): { burning: string; market: string; asOf: string } {
  const m = a.market
  const b = a.burn
  const rolls = (p: { low: number; mid: number; high: number }) => (p.low === p.high ? `${p.mid}` : `${p.low}–${p.high}, typically ${p.mid}`)
  let burning: string
  let market: string
  if (a.mode === "pixels") {
    burning = b && b.picks.length
      ? b.reached
        ? `Burning route: ~${ethText(b.costEth)} for ${b.picks.length} floor ${b.picks.length === 1 ? "Normie" : "Normies"} (${rolls(b)} pixels)${a.burnSure?.reached && a.burnSure.costEth !== b.costEth ? `; ~${ethText(a.burnSure.costEth)} to reach ${a.need} even with the worst rolls` : ""}.`
        : `Burning route: the cheapest listings cannot reach ${a.need} pixels right now.`
      : "Burning route: no usable listings right now."
    market = m
      ? m.shortfall > 0
        ? `Pixel Market route: only ${m.pixels} pixels listed (~${ethText(m.costEth)}).`
        : `Pixel Market route: ~${ethText(m.costEth)} for ${a.need} pixels${m.approx ? " (approximate: some listings must be bought whole)" : ""}.`
      : "Pixel Market route: the order book could not be read just now."
  } else {
    burning = b && b.picks.length
      ? `Burning route: ${rolls(b)} pixels for ~${ethText(b.costEth)} (${b.picks.length} floor ${b.picks.length === 1 ? "Normie" : "Normies"}).`
      : "Burning route: no listed Normie fits inside that budget."
    market = m ? `Pixel Market route: ${m.pixels} pixels for ~${ethText(m.costEth)}.` : "Pixel Market route: the order book could not be read just now."
  }
  return { burning, market, asOf: `As of ${utc(asOf)}. Gas not included. Listings and prices move fast.` }
}
