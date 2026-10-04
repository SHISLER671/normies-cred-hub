import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { applyPlanToRows, planCensusRefresh, MAX_BURNED_SHARE, type BulkRow, type IndexRowLite } from "./census-refresh"

const idx = (token_id: number, over: Partial<IndexRowLite> = {}): IndexRowLite => ({ token_id, action_points: 0, level: 1, customized: false, burned: false, ...over })
const bulk = (id: number, over: Partial<BulkRow> = {}): BulkRow => ({ id, actionPoints: 0, level: 1, customized: false, ...over })
const ok = { expectedLiving: 4, pagesOk: true }

describe("planCensusRefresh", () => {
  it("finds AP, level and edited-art changes and leaves identical rows alone", () => {
    const p = planCensusRefresh(
      [bulk(1, { actionPoints: 40, level: 5 }), bulk(2), bulk(3, { customized: true }), bulk(4)],
      [idx(1), idx(2), idx(3), idx(4)],
      ok,
    )
    assert.deepEqual(p.updates.map((u) => [u.token_id, u.action_points, u.level, u.customized]), [[1, 40, 5, false], [3, 0, 1, true]])
    assert.equal(p.unchanged, 2)
    assert.deepEqual(p.burned, [])
    assert.equal(p.burnedGuardOk, true)
  })

  it("a living index row missing from a COMPLETE bulk list is burned", () => {
    const rows = Array.from({ length: 40 }, (_, i) => idx(i + 1))
    const p = planCensusRefresh(rows.filter((r) => r.token_id !== 17).map((r) => bulk(r.token_id)), rows, { expectedLiving: 39, pagesOk: true })
    assert.deepEqual(p.burned, [17])
    assert.equal(p.burnedGuardOk, true)
  })

  it("never marks anything burned when a page failed, the list is short, or it has duplicates", () => {
    const rows = [idx(1), idx(2), idx(3), idx(4)]
    assert.equal(planCensusRefresh([bulk(1), bulk(2), bulk(3)], rows, { expectedLiving: 3, pagesOk: false }).burnedGuardOk, false)
    assert.equal(planCensusRefresh([bulk(1), bulk(2), bulk(3)], rows, { expectedLiving: 4, pagesOk: true }).burnedGuardOk, false)
    assert.equal(planCensusRefresh([bulk(1), bulk(1), bulk(2)], rows, { expectedLiving: 3, pagesOk: true }).burnedGuardOk, false)
  })

  it(`refuses to mark more than ${MAX_BURNED_SHARE * 100}% of the index burned in one run (a truncated list looks like that)`, () => {
    const rows = Array.from({ length: 100 }, (_, i) => idx(i))
    const p = planCensusRefresh(rows.slice(0, 80).map((r) => bulk(r.token_id)), rows, { expectedLiving: 80, pagesOk: true })
    assert.equal(p.burned.length, 20)
    assert.equal(p.burnedGuardOk, false)
    assert.match(p.burnedGuardWhy, /more than 5%/)
  })

  it("AP updates are still planned when the burned guard fails", () => {
    const p = planCensusRefresh([bulk(1, { actionPoints: 9 })], [idx(1), idx(2)], { expectedLiving: 99, pagesOk: true })
    assert.equal(p.burnedGuardOk, false)
    assert.equal(p.updates.length, 1)
  })

  it("tokens in the bulk list that the index has as burned or lacks are reported, not invented", () => {
    const p = planCensusRefresh([bulk(1), bulk(7)], [idx(1), idx(7, { burned: true })], { expectedLiving: 2, pagesOk: true })
    assert.deepEqual(p.notInIndex, [7])
  })
})

describe("applyPlanToRows (the 'after' picture, nothing written)", () => {
  const rows = Array.from({ length: 40 }, (_, i) => ({ ...idx(i + 1), owner: `0x${i}` }))
  it("applies updates and drops burned rows", () => {
    const living = rows.filter((r) => r.token_id !== 40).map((r) => bulk(r.token_id, r.token_id === 1 ? { actionPoints: 30 } : {}))
    const plan = planCensusRefresh(living, rows, { expectedLiving: 39, pagesOk: true })
    const after = applyPlanToRows(rows, plan)
    assert.equal(after.length, 39)
    assert.equal(after.find((r) => r.token_id === 1)!.action_points, 30)
    assert.ok(!after.some((r) => r.token_id === 40))
  })
  it("keeps burned rows when the guard failed", () => {
    const plan = planCensusRefresh(rows.slice(0, 39).map((r) => bulk(r.token_id)), rows, { expectedLiving: 99, pagesOk: true })
    assert.equal(applyPlanToRows(rows, plan).length, 40)
  })
})
