import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

import { ASK_ARENA_READ_TIMEOUT_MS, askArenaLines, loadAskArenaReads } from "./arenaFacts"
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

describe("Arena reads inside the Ask time budget", () => {
  it("one Arena read gets no more time than Ask's other context reads (8 s), so the context build is no slower", () => {
    assert.ok(ASK_ARENA_READ_TIMEOUT_MS <= 8_000)
    const context = readFileSync(new URL("./buildContext.ts", import.meta.url), "utf8")
    assert.match(context, /loadAskArenaReads\(mentionedTokenIds, /, "read inside the context build's one parallel batch")
  })
  it("a read that runs out of time is 'couldn't read right now', never missing data, and doesn't hold up the other", async () => {
    const started = Date.now()
    const never = new Promise<never>(() => {})
    const reads = await loadAskArenaReads([7141, 42], {
      timeoutMs: 40,
      load: (id) => (id === 7141 ? never : Promise.reject(new Error("boom"))),
    })
    assert.ok(Date.now() - started < 2_000, "returned at the time limit")
    assert.deepEqual(reads.map((r) => [r.tokenId, r.sector]), [[7141, null], [42, null]])
    for (const r of reads) {
      const text = askArenaLines(r, "https://nch.example")
      assert.match(text, /COULD NOT READ the Arena right now/)
      assert.doesNotMatch(text, /in Arena:|rounds played|status line|round list/)
    }
  })
  it("two reads run in parallel, not one after the other", async () => {
    const started = Date.now()
    const slow = () => new Promise<never>(() => {})
    await loadAskArenaReads([1, 2], { timeoutMs: 150, load: slow })
    assert.ok(Date.now() - started < 290, "about one time limit, not two")
  })
})
