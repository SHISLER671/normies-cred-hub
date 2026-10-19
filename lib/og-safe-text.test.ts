import assert from "node:assert/strict"
import { test } from "node:test"

import { ogSafeText } from "./og-safe-text"

test("plain names pass through", () => {
  assert.equal(ogSafeText("Zulo"), "Zulo")
  assert.equal(ogSafeText("Normie #7141"), "Normie #7141")
  assert.equal(ogSafeText("Café Agent!"), "Café Agent!")
})

test("markup, SVG/CSS syntax, quotes, slashes and control characters are removed", () => {
  for (const bad of ['<svg onload=alert(1)>', '"><image href="x"/>', "{{constructor}}", "url(javascript:x)", "a\u0000b‮c", "x;y:z/\\`"]) {
    assert.doesNotMatch(ogSafeText(bad), /[<>"{}()/\;:`=\u0000‮]/, bad)
  }
})

test("length is capped and empty input is empty", () => {
  assert.equal(ogSafeText("x".repeat(100)).length, 32)
  assert.equal(ogSafeText(null), "")
  assert.equal(ogSafeText("   "), "")
})
