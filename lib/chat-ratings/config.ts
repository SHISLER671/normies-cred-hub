/**
 * Chat ratings — tuning knobs.
 *
 * NCH ranks signal over noise. Every number that decides how much a rating counts lives here,
 * so the weights can be tuned once real rating data comes in without touching the math in ./score.ts.
 *
 * Source: Hive chat ratings on normies.art ("How was talking to <agent>?"), written by the rater's
 * own wallet to the ERC-8004 Reputation Registry. These measure how good a chat with the agent was.
 * They are NOT a trust score for the agent's owner, and nothing in NCH treats them as one.
 */
export const CHAT_RATINGS_CONFIG = {
  /**
   * Which feedback counts as a Hive chat rating. Verified on-chain 2026-10-18 (tag1 "starred", tag2 "hive-chat").
   * Matching is on tag2 only; tag1 is recorded for reference so a change to Hive's star tag can't hide ratings.
   */
  source: {
    tag1: "starred",
    tag2: "hive-chat",
    /** Plain-word label shown in the UI. Never "Reputation". */
    label: "Chat rating",
  },

  /** Hive writes 0–100 (5 stars = 100). Values outside 0..maxValue are clamped. */
  maxValue: 100,

  /** Below this many different wallets, NCH shows "not enough ratings yet" instead of a ranked score. */
  minUniqueRaters: 5,

  weights: {
    /** Multiplier for a rater wallet that holds at least one Normie. */
    holder: 1.5,
    /** Multiplier for a rater wallet with fewer than `establishedTxCount` transactions (fresh / throwaway). */
    freshWallet: 0.5,
    /** Sent transactions at which a wallet stops counting as fresh. */
    establishedTxCount: 10,
    /**
     * Each wallet's ratings are averaged into one vote, so ten ratings from one wallet never outweigh ten people.
     * A wallet that keeps coming back still earns a small, capped boost: +repeatStep per extra rating, up to repeatMax.
     */
    repeatStep: 0.1,
    repeatMax: 1.5,
  },

  recency: {
    /** A rating this many days old counts half as much as one from today. */
    halfLifeDays: 90,
    /** Floor so very old ratings still count a little. */
    minWeight: 0.1,
  },

  limits: {
    /** Most raters enriched with holder / wallet-age reads per agent; the rest count at neutral weight. */
    maxRatersEnriched: 40,
    /** Hard cap for the whole read so Pulse and Ask never wait on it. */
    timeoutMs: 4_000,
    /** Server cache per agent. Ratings are permanent on-chain, so a few minutes stale is fine. */
    cacheMs: 5 * 60_000,
  },
} as const

export type ChatRatingsConfig = typeof CHAT_RATINGS_CONFIG
