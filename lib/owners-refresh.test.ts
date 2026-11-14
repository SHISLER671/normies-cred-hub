import { describe, it } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"

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

describe("planOwnersRefresh: owner_since (Pulse level 4 counts the owner's days from it)", () => {
  const NOW = "2026-11-14T06:00:00.000Z"
  it("owner changed: owner_since is the time of this run", () => {
    const plan = planOwnersRefresh(chainOf(100, (i) => (i === 5 ? B : A)), rows(100), NOW)
    assert.deepEqual(plan.updates, [{ token_id: 5, owner: B, owner_since: NOW }])
  })
  it("owner unchanged: no update at all, so owner_since is left alone", () => {
    const plan = planOwnersRefresh(chainOf(100, () => A), rows(100), NOW)
    assert.equal(plan.updates.length, 0)
    assert.equal(plan.unchanged, 100)
  })
  it("owner unknown (lookup failed): no update, so neither owner nor owner_since moves", () => {
    const plan = planOwnersRefresh(chainOf(100, (i) => (i === 5 ? null : A)), rows(100), NOW)
    assert.equal(plan.updates.length, 0)
    assert.deepEqual(plan.unknown, [5])
  })
  it("a first-seen owner (index had none) starts counting now, never earlier", () => {
    const index = rows(100).map((r) => (r.token_id === 5 ? { ...r, owner: null } : r))
    const plan = planOwnersRefresh(chainOf(100, () => A), index, NOW)
    assert.deepEqual(plan.updates, [{ token_id: 5, owner: A, owner_since: NOW }])
  })
  it("defaults to the current time when no time is passed", () => {
    const before = Date.now()
    const plan = planOwnersRefresh(chainOf(100, (i) => (i === 5 ? B : A)), rows(100))
    const at = Date.parse(plan.updates[0].owner_since)
    assert.ok(at >= before && at <= Date.now())
  })
  it("a guard trip still writes nothing, owner_since included", () => {
    const plan = planOwnersRefresh(chainOf(100, (i) => (i < 40 ? C : A)), rows(100), NOW)
    assert.equal(plan.ok, false)
    assert.equal(plan.updates.length, 0)
  })
})

describe("the owners-refresh job and the SQL draft", () => {
  const job = fs.readFileSync("supabase/functions/owners-refresh/index.ts", "utf8")
  it("the job writes owner and owner_since together, from the plan", () => {
    assert.match(job, /\.update\(\{ owner: u\.owner, owner_since: u\.owner_since \}\)/)
    assert.doesNotMatch(job, /\.update\(\{ owner: u\.owner \}\)/)
  })
  it("the SQL file is a DRAFT that adds a nullable owner_since", () => {
    const files = fs.readdirSync("supabase/sql").filter((f) => /^2026-11-\d\d-normie-owner-since\.sql$/.test(f))
    assert.equal(files.length, 1)
    const sql = fs.readFileSync(`supabase/sql/${files[0]}`, "utf8")
    assert.match(sql.split("\n")[0], /^-- DRAFT/)
    assert.match(sql, /add column if not exists owner_since timestamptz null/)
    assert.doesNotMatch(sql, /security definer/i)
    assert.match(sql, /revoke execute on function public\.normie_index_touch_owner_since\(\) from public, anon, authenticated/)
  })
})
