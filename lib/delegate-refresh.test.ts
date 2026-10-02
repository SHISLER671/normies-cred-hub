import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { planDelegateChanges } from "./delegate-refresh"

const A = "0xAAAAaaaaAAAAaaaaAAAAaaaaAAAAaaaaAAAAaaaa"
const B = "0xbbbbBBBBbbbbBBBBbbbbBBBBbbbbBBBBbbbbBBBB"

describe("planDelegateChanges", () => {
  it("classifies added, changed, removed and unchanged", () => {
    const plan = planDelegateChanges(
      new Map<number, string | null | undefined>([[1, A], [2, B], [3, null], [4, A], [5, null]]),
      new Map<number, string | null>([[1, null], [2, A.toLowerCase()], [3, A.toLowerCase()], [4, A.toLowerCase()], [5, null]]),
    )
    assert.deepEqual(plan.changes.map((c) => [c.tokenId, c.kind]), [[1, "added"], [2, "changed"], [3, "removed"]])
    assert.equal(plan.unchanged, 2)
  })

  it("compares addresses case-insensitively and stores lowercase", () => {
    const plan = planDelegateChanges(new Map([[1, A]]), new Map([[1, A.toLowerCase()]]))
    assert.equal(plan.changes.length, 0)
    const p2 = planDelegateChanges(new Map([[1, B]]), new Map([[1, null]]))
    assert.equal(p2.changes[0].to, B.toLowerCase())
  })

  it("never touches a token whose live lookup failed (undefined = unknown, not 'removed')", () => {
    const plan = planDelegateChanges(new Map<number, string | null | undefined>([[1, undefined]]), new Map([[1, A.toLowerCase()]]))
    assert.equal(plan.changes.length, 0)
    assert.equal(plan.unknown, 1)
  })

  it("reports tokens that have no index row instead of inventing one", () => {
    const plan = planDelegateChanges(new Map([[9, A]]), new Map())
    assert.deepEqual(plan.notInIndex, [9])
    assert.equal(plan.changes.length, 0)
  })

  it("treats the zero address as no delegate, so it is not a change", () => {
    const ZERO = "0x0000000000000000000000000000000000000000"
    const plan = planDelegateChanges(new Map<number, string | null | undefined>([[2, null], [3, ZERO]]), new Map<number, string | null>([[2, ZERO], [3, null]]))
    assert.equal(plan.changes.length, 0)
    assert.equal(plan.unchanged, 2)
  })
})
