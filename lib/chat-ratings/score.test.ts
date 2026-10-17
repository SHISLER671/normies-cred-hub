import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { CHAT_RATINGS_CONFIG } from "./config"
import {
  normalizeValue,
  rankChatRatings,
  raterMultiplier,
  recencyWeight,
  type RawChatRating,
  type RaterInfo,
} from "./score"

const w = (n: number) => `0x${n.toString(16).padStart(40, "0")}`
const rate = (rater: string, value: number, ageDays: number | null = 0): RawChatRating => ({
  rater,
  value,
  decimals: 0,
  ageDays,
})

describe("normalizeValue", () => {
  it("reads Hive's 0–100 values as-is", () => {
    assert.equal(normalizeValue(100, 0, 100), 100)
    assert.equal(normalizeValue(60, 0, 100), 60)
  })
  it("applies on-chain decimals and clamps", () => {
    assert.equal(normalizeValue(9550, 2, 100), 95.5)
    assert.equal(normalizeValue(250, 0, 100), 100)
    assert.equal(normalizeValue(-20, 0, 100), 0)
  })
  it("rejects junk", () => {
    assert.equal(normalizeValue(Number.NaN, 0, 100), null)
    assert.equal(normalizeValue(50, -1, 100), null)
  })
})

describe("recencyWeight", () => {
  const r = CHAT_RATINGS_CONFIG.recency
  it("today and unknown age count fully", () => {
    assert.equal(recencyWeight(0, r), 1)
    assert.equal(recencyWeight(null, r), 1)
  })
  it("halves at one half-life and never drops below the floor", () => {
    assert.equal(recencyWeight(r.halfLifeDays, r), 0.5)
    assert.equal(recencyWeight(10_000, r), r.minWeight)
  })
})

describe("raterMultiplier", () => {
  const cfg = CHAT_RATINGS_CONFIG.weights
  it("boosts holders and discounts fresh wallets", () => {
    assert.equal(raterMultiplier({ holder: true }, 1, cfg), cfg.holder)
    assert.equal(raterMultiplier({ txCount: 0 }, 1, cfg), cfg.freshWallet)
    assert.equal(raterMultiplier(undefined, 1, cfg), 1)
  })
  it("caps the repeat boost", () => {
    assert.equal(raterMultiplier(undefined, 2, cfg), 1 + cfg.repeatStep)
    assert.equal(raterMultiplier(undefined, 500, cfg), cfg.repeatMax)
  })
})

describe("rankChatRatings", () => {
  it("withholds a ranked score below the minimum number of wallets", () => {
    const s = rankChatRatings([rate(w(1), 100), rate(w(2), 0)])
    assert.equal(s.ranked, false)
    assert.equal(s.score, null)
    assert.equal(s.stars, null)
    assert.equal(s.raw.ratings, 2)
    assert.equal(s.raw.unique_raters, 2)
    assert.equal(s.raw.average, 50)
  })

  it("ranks once enough different wallets have rated", () => {
    const ratings = [1, 2, 3, 4, 5].map((n) => rate(w(n), 80))
    const s = rankChatRatings(ratings)
    assert.equal(s.ranked, true)
    assert.equal(s.score, 80)
    assert.equal(s.stars, 4)
  })

  it("one wallet spamming ratings is still one vote (averaged, capped boost)", () => {
    const honest = [1, 2, 3, 4, 5].map((n) => rate(w(n), 20))
    const spam = Array.from({ length: 50 }, () => rate(w(99), 100))
    const s = rankChatRatings([...honest, ...spam])
    assert.equal(s.raw.unique_raters, 6)
    assert.equal(s.weighting.repeat_raters, 1)
    // Spammer weight is capped at repeatMax (1.5) vs 5 honest votes at 1.0 each → (5*20 + 1.5*100) / 6.5
    assert.equal(s.score, Math.round(((5 * 20 + 1.5 * 100) / 6.5) * 10) / 10)
    // The raw average shows the noise the ranked score filtered out.
    assert.ok((s.raw.average ?? 0) > (s.score ?? 0))
  })

  it("a returning wallet's latest chats weigh more inside its own average", () => {
    const others = [1, 2, 3, 4].map((n) => rate(w(n), 60))
    const s = rankChatRatings([...others, rate(w(9), 0, 365), rate(w(9), 100, 0)])
    // Wallet 9 averages above 50 because its recent 100 outweighs its year-old 0.
    assert.ok((s.score ?? 0) > 60)
  })

  it("holders count more, fresh wallets count less", () => {
    const ratings = [1, 2, 3, 4, 5, 6].map((n) => rate(w(n), n <= 3 ? 100 : 0))
    const info = new Map<string, RaterInfo>()
    for (const n of [1, 2, 3]) info.set(w(n), { holder: true, txCount: 500 })
    for (const n of [4, 5, 6]) info.set(w(n), { holder: false, txCount: 1 })
    const s = rankChatRatings(ratings, info)
    assert.equal(s.weighting.holders, 3)
    assert.equal(s.weighting.fresh_wallets, 3)
    // 3 × 1.5 at 100 vs 3 × 0.5 at 0 → 75
    assert.equal(s.score, 75)
    assert.equal(s.raw.average, 50)
  })

  it("delegated-vault holders count as holders and are reported separately", () => {
    const ratings = [1, 2, 3, 4, 5].map((n) => rate(w(n), 100))
    const info = new Map<string, RaterInfo>()
    info.set(w(1), { holder: true, holderVia: "wallet" })
    info.set(w(2), { holder: true, holderVia: "delegate" })
    const s = rankChatRatings(ratings, info)
    assert.equal(s.weighting.holders, 2)
    assert.equal(s.weighting.delegated_holders, 1)
  })

  it("old ratings fade but never vanish", () => {
    const fresh = [1, 2, 3, 4, 5].map((n) => rate(w(n), 100, 0))
    const ancient = [6, 7, 8, 9, 10].map((n) => rate(w(n), 0, 3650))
    const s = rankChatRatings([...fresh, ...ancient])
    assert.ok((s.score ?? 0) > 85)
    assert.ok((s.score ?? 0) < 100)
  })

  it("excludes the agent owner's own ratings", () => {
    const ratings = [1, 2, 3, 4, 5].map((n) => rate(w(n), 40))
    const s = rankChatRatings([...ratings, rate(w(77).toUpperCase().replace("0X", "0x"), 100)], undefined, {
      excludeRaters: [w(77)],
    })
    assert.equal(s.weighting.excluded_self, 1)
    assert.equal(s.raw.ratings, 5)
    assert.equal(s.score, 40)
  })

  it("empty input is a clean zero state", () => {
    const s = rankChatRatings([])
    assert.equal(s.ranked, false)
    assert.equal(s.score, null)
    assert.equal(s.raw.ratings, 0)
    assert.equal(s.raw.average, null)
  })
})
