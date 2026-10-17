import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { NORMIES_NFT } from "@/constants/contracts"
import type { V1Delegation, V2Delegation } from "@/lib/delegations"

import { holdsViaDelegate, type DelegatedHolderDeps } from "./delegated"

const ZERO = "0x0000000000000000000000000000000000000000"
const HOT = "0x1111111111111111111111111111111111111111" as const
const VAULT = "0x2222222222222222222222222222222222222222"
const OTHER = "0x3333333333333333333333333333333333333333"

function deps(over: Partial<DelegatedHolderDeps> & { balances?: Record<string, bigint>; owners?: Record<number, string> } = {}): DelegatedHolderDeps {
  const balances = over.balances ?? {}
  const owners = over.owners ?? {}
  return {
    readV1: over.readV1 ?? (async () => []),
    readV2: over.readV2 ?? (async () => []),
    vaultBalance: over.vaultBalance ?? (async (v) => balances[v.toLowerCase()] ?? BigInt(0)),
    tokenOwner: over.tokenOwner ?? (async (id) => owners[id] ?? OTHER),
  }
}

const v1All: V1Delegation = { type_: 1, vault: VAULT, delegate: HOT, contract_: ZERO, tokenId: BigInt(0) }
const v2Token = (tokenId: number): V2Delegation => ({ type_: 3, from: VAULT, contract_: NORMIES_NFT, tokenId: BigInt(tokenId) })

describe("holdsViaDelegate", () => {
  it("v1 whole-wallet delegation to a vault that holds a Normie counts", async () => {
    const r = await holdsViaDelegate(HOT, deps({ readV1: async () => [v1All], balances: { [VAULT]: BigInt(1) } }))
    assert.equal(r, true)
  })

  it("v1 whole-wallet delegation to an empty vault does not", async () => {
    const r = await holdsViaDelegate(HOT, deps({ readV1: async () => [v1All], balances: { [VAULT]: BigInt(0) } }))
    assert.equal(r, false)
  })

  it("v2 single-token delegation counts only while the vault still owns that token", async () => {
    const live = await holdsViaDelegate(HOT, deps({ readV2: async () => [v2Token(7141)], owners: { 7141: VAULT } }))
    const sold = await holdsViaDelegate(HOT, deps({ readV2: async () => [v2Token(7141)], owners: { 7141: OTHER } }))
    assert.equal(live, true)
    assert.equal(sold, false)
  })

  it("a delegation for another contract is ignored", async () => {
    const other: V2Delegation = { type_: 3, from: VAULT, contract_: OTHER, tokenId: BigInt(1) }
    const r = await holdsViaDelegate(HOT, deps({ readV2: async () => [other], owners: { 1: VAULT } }))
    assert.equal(r, false)
  })

  it("no delegations and both registries read = false", async () => {
    assert.equal(await holdsViaDelegate(HOT, deps()), false)
  })

  it("a registry that can't be read is unknown, never 'not a holder'", async () => {
    const r = await holdsViaDelegate(HOT, deps({ readV1: async () => { throw new Error("rpc") } }))
    assert.equal(r, undefined)
  })

  it("one failing registry does not hide a holding found on the other", async () => {
    const r = await holdsViaDelegate(
      HOT,
      deps({ readV1: async () => { throw new Error("rpc") }, readV2: async () => [v2Token(7141)], owners: { 7141: VAULT } }),
    )
    assert.equal(r, true)
  })

  it("an unreadable vault balance is unknown, not false", async () => {
    const r = await holdsViaDelegate(HOT, deps({ readV1: async () => [v1All], vaultBalance: async () => { throw new Error("rpc") } }))
    assert.equal(r, undefined)
  })
})
