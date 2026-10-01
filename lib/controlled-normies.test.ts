import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { fetchCanvasDelegatedFromIndex, tokenIdsFromV2Delegations, type DelegationV2 } from "./controlled-normies"

const NORMIES = "0x9Eb6E2025B64f340691e424b7fe7022fFDE12438"
const OTHER = "0x1111111111111111111111111111111111111111"
const OWNER = "0xFafd8Fb6b4E43ACE0E365553f1b9242384591031"
const d = (type_: number, over: Partial<DelegationV2> = {}): DelegationV2 => ({
  type_, from: OWNER, contract_: NORMIES, tokenId: BigInt(0), ...over,
})
const noHolders = async () => { throw new Error("should not look up a vault") }

describe("tokenIdsFromV2Delegations", () => {
  it("returns #7141 for the real on-chain ERC721 delegation (0xfafd -> 0xb879)", async () => {
    const ids = await tokenIdsFromV2Delegations([d(3, { tokenId: BigInt(7141) })], noHolders)
    assert.deepEqual(ids, [7141])
  })

  it("ignores ERC721 delegations for other collections", async () => {
    assert.deepEqual(await tokenIdsFromV2Delegations([d(3, { contract_: OTHER, tokenId: BigInt(5) })], noHolders), [])
  })

  it("ALL and CONTRACT delegations enumerate the vault's holdings once", async () => {
    const calls: string[] = []
    const holdersOf = async (v: string) => { calls.push(v); return [7141, 9] }
    const ids = await tokenIdsFromV2Delegations([d(1), d(2)], holdersOf)
    assert.deepEqual(ids, [7141, 9])
    assert.equal(calls.length, 1)
  })

  it("CONTRACT delegation for another collection and ERC20/1155 types are ignored", async () => {
    const ids = await tokenIdsFromV2Delegations(
      [d(2, { contract_: OTHER }), d(4), d(5, { tokenId: BigInt(7141) }), d(0)], noHolders)
    assert.deepEqual(ids, [])
  })

  it("a failing vault lookup does not lose the other ids", async () => {
    const ids = await tokenIdsFromV2Delegations([d(3, { tokenId: BigInt(7141) }), d(1)], noHolders)
    assert.deepEqual(ids, [7141])
  })
})

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
