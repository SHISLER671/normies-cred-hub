import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { planOwnersRefresh, type OwnerRowLite } from "./owners-refresh"

const A = "0x" + "a".repeat(40)
const B = "0x" + "b".repeat(40)
const C = "0x" + "c".repeat(40)
const rows = (n: number, owner = A): OwnerRowLite[] => Array.from({ length: n }, (_, i) => ({ token_id: i, owner, burned: false }))
const chainOf = (n: number, f: (i: number) => string | null) => new Map(Array.from({ length: n }, (_, i) => [i, f(i)] as const))

describe("planOwnersRefresh", () => {
  it("updates only the owners that changed, case-insensitively", () => {
    const index = rows(100)
    const plan = planOwnersRefresh(chainOf(100, (i) => (i < 4 ? B : A.toUpperCase().replace("0X", "0x"))), index)
    assert.equal(plan.ok, true)
    assert.deepEqual(plan.updates.map((u) => u.token_id), [0, 1, 2, 3])
    assert.ok(plan.updates.every((u) => u.owner === B))
    assert.equal(plan.unchanged, 96)
  })
  it("skips burned rows entirely", () => {
    const index = [...rows(50), { token_id: 900, owner: null, burned: true }]
    const plan = planOwnersRefresh(chainOf(50, () => A), index)
    assert.equal(plan.updates.length, 0)
    assert.equal(plan.unknown.length, 0)
  })
  it("leaves a token with a failed lookup alone and lists it", () => {
    const plan = planOwnersRefresh(chainOf(100, (i) => (i === 7 ? null : A)), rows(100))
    assert.equal(plan.ok, true)
    assert.deepEqual(plan.unknown, [7])
    assert.equal(plan.updates.length, 0)
  })
  it("a token missing from the chain map counts as unknown, never as a change", () => {
    const chain = chainOf(100, () => A)
    chain.delete(3)
    assert.deepEqual(planOwnersRefresh(chain, rows(100)).unknown, [3])
  })
  it("writes nothing when too many lookups failed (an RPC problem)", () => {
    const plan = planOwnersRefresh(chainOf(100, (i) => (i < 10 ? null : B)), rows(100))
    assert.equal(plan.ok, false)
    assert.equal(plan.updates.length, 0)
  })
  it("writes nothing when far too many owners would change", () => {
    const plan = planOwnersRefresh(chainOf(100, (i) => (i < 40 ? C : A)), rows(100))
    assert.equal(plan.ok, false)
    assert.match(plan.why, /too many/)
    assert.equal(plan.updates.length, 0)
  })
  it("rejects a malformed address from the chain as unknown", () => {
    const plan = planOwnersRefresh(chainOf(100, (i) => (i === 0 ? "0x1234" : A)), rows(100))
    assert.deepEqual(plan.unknown, [0])
  })
})
