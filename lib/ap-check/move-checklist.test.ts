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
  it("follows the docs: no wallet-to-wallet #PIXEL transfer, so take pixels off only when selling; revenue share is per epoch, not per month", () => {
    const text = MOVE_CHECKLIST.map((i) => `${i.title} ${i.body}`).join(" ")
    assert.match(text, /no wallet-to-wallet #PIXEL transfer/)
    assert.match(text, /leaving them on is the only way to move them to another wallet of yours/)
    assert.match(text, /If you are selling it or giving it away, take them off first/)
    assert.match(text, /four times a day, at unpredictable moments, during each epoch/)
    assert.match(text, /revoke afterwards/)
    assert.doesNotMatch(text, /month/i)
  })
  it("says nothing about Abnormie alignment until an official source does", () => {
    assert.doesNotMatch(MOVE_CHECKLIST.map((i) => i.body).join(" "), /abnormie|alignment/i)
  })
})
