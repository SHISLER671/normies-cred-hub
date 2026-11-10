import assert from "node:assert/strict"
import { test } from "node:test"

import { publicReputationOnly } from "./ethos-public"

const ADDR = "0x1234567890abcdef1234567890abcdef12345678"

test("drops every field that could tie a wallet to a person or a social profile", () => {
  const out = publicReputationOnly(
    {
      id: 7, score: 1420, username: "someone", displayName: "Real Name", avatarUrl: "https://x", description: "bio",
      userkeys: ["service:x.com:123"], links: { profile: "https://app.ethos.network/profile/x/someone", scoreBreakdown: "https://app.ethos.network/profile/x/someone/score" },
      stats: { vouch: { received: { count: 3 } } }, xpTotal: 50,
    },
    ADDR,
  )!
  const json = JSON.stringify(out)
  assert.doesNotMatch(json, /someone|Real Name|bio|x\.com/)
  assert.equal(out.score, 1420)
  assert.equal(out.links.scoreBreakdown, `https://app.ethos.network/profile/${ADDR}`)
  assert.deepEqual(out.stats, { vouch: { received: { count: 3 } } })
})

test("junk in, null out", () => {
  assert.equal(publicReputationOnly(null, ADDR), null)
  assert.equal(publicReputationOnly("x", ADDR), null)
})
