import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

import { ASK_BUDGET_MS, attemptTimeout } from "./generate"

describe("Ask time budget", () => {
  it("caps one attempt at its own limit when there is plenty of time", () => {
    assert.equal(attemptTimeout(1_000_000, 0), 45_000)
  })
  it("shrinks an attempt to what is left of the budget", () => {
    assert.equal(attemptTimeout(100_000, 70_000), 30_000)
  })
  it("a first provider that burns its full 45 s still leaves the fallback a real attempt", () => {
    const start = 0
    const afterContext = start + 15_000 // slow context build
    const deadline = start + ASK_BUDGET_MS
    const first = attemptTimeout(deadline, afterContext)
    const afterFirst = afterContext + first
    assert.equal(first, 45_000)
    assert.ok(attemptTimeout(deadline, afterFirst) >= 8_000)
  })
  it("worst case (context + two full attempts) fits under the route's maxDuration with margin", () => {
    const route = readFileSync(new URL("../../app/api/zulo/ask/route.ts", import.meta.url), "utf8")
    const max = Number(/export const maxDuration = (\d+)/.exec(route)?.[1])
    assert.ok(Number.isFinite(max))
    assert.ok(ASK_BUDGET_MS <= max * 1000 - 5_000, `budget ${ASK_BUDGET_MS} vs maxDuration ${max}s`)
  })
})
