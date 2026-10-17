// Chat ratings — pure formatting (safe for client and server bundles; no RPC imports).
import type { ChatRatingsSummary } from "./load"

/** One line for prompts and summaries, e.g. "Chat rating 4.6★ (92/100) from 7 wallets, 9 ratings". */
export function chatRatingsLine(s: ChatRatingsSummary | null | undefined): string | null {
  if (!s || !s.available) return null
  const { ratings, unique_raters } = s.raw
  if (ratings === 0) return `${s.label}: no Hive chat ratings yet`
  const counts = `${unique_raters} wallet${unique_raters === 1 ? "" : "s"}, ${ratings} rating${ratings === 1 ? "" : "s"}`
  if (!s.ranked || s.score == null) {
    return `${s.label}: not enough ratings yet (${counts}; ranks at ${s.min_unique_raters} wallets)`
  }
  return `${s.label} ${s.stars}★ (${s.score}/100) from ${counts}`
}
