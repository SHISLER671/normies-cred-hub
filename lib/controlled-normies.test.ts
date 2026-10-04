import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { fetchCanvasDelegatedFromIndex } from "./controlled-normies"


function fakeDb(rows: unknown, oldest: unknown, err: { message: string } | null = null) {
  const chain = (data: unknown) => {
    const c: Record<string, unknown> = {}
    const self = () => c
    for (const m of ["select", "eq", "order", "limit"]) c[m] = self
    c.then = (res: (v: unknown) => unknown) => res({ data, error: err })
    return c
  }
  let n = 0
  return { from: () => chain(n++ === 0 ? rows : oldest) } as never
}

describe("fetchCanvasDelegatedFromIndex", () => {
  it("returns delegated token ids and the index age", async () => {
    const r = await fetchCanvasDelegatedFromIndex("0xB879", fakeDb([{ token_id: 7141 }], [{ indexed_at: "2026-09-29T11:22:03Z" }]))
    assert.deepEqual(r, { tokenIds: [7141], asOf: "2026-09-29T11:22:03Z", checked: true })
  })

  it("no delegations is a checked, empty answer", async () => {
    const r = await fetchCanvasDelegatedFromIndex("0xB879", fakeDb([], [{ indexed_at: "2026-09-29T11:22:03Z" }]))
    assert.deepEqual(r.tokenIds, [])
    assert.equal(r.checked, true)
  })

  it("a database error is UNKNOWN (checked=false), never an empty fact", async () => {
    const r = await fetchCanvasDelegatedFromIndex("0xB879", fakeDb(null, null, { message: "down" }))
    assert.deepEqual(r, { tokenIds: [], asOf: null, checked: false })
  })

  it("no database configured is also unknown", async () => {
    assert.equal((await fetchCanvasDelegatedFromIndex("0xB879", null)).checked, false)
  })
})
