import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { MOVE_CHECKLIST } from "./move-checklist"

describe("before you move a Normie", () => {
  it("every claim cites an official source (only the plain safety habit has none)", () => {
    for (const item of MOVE_CHECKLIST) {
      if (item.title === "Send it safely.") continue
      assert.ok(item.source, item.title)
      assert.match(item.source!.url, /^https:\/\/(www\.normies\.art|api\.normies\.art|simulator\.normies\.art|etherscan\.io)\//, item.title)
    }
  })
  it("states the official agent rule and the contract's allowance rule", () => {
    const text = MOVE_CHECKLIST.map((i) => `${i.title} ${i.body}`).join(" ")
    assert.match(text, /whoever owns it controls its agent/)
    assert.match(text, /cannot be undone/)
    assert.match(text, /from the wallet or from any Normie it owns/)
  })
  it("says nothing about Abnormie alignment until an official source does", () => {
    assert.doesNotMatch(MOVE_CHECKLIST.map((i) => i.body).join(" "), /abnormie|alignment/i)
  })
})
