import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { DELEGATE_REGISTRY_ABI } from "../constants/contracts"
import {
  claimsFromV1,
  claimsFromV2,
  delegationCheckIncomplete,
  findDelegateXyz,
  resolveClaims,
  type V1Delegation,
  type V2Delegation,
} from "./delegations"

const NORMIES = "0x9Eb6E2025B64f340691e424b7fe7022fFDE12438"
const OTHER = "0x1111111111111111111111111111111111111111"
const ZERO = "0x0000000000000000000000000000000000000000"
// Real mainnet data, read 2026-10-05.
const HOT_V2 = "0xb8792E6516b88e73eD0723F8C1C8a92531A98767" // 32626.eth
const VAULT_V2 = "0xFafd8Fb6b4E43ACE0E365553f1b9242384591031"
const VAULT_V1 = "0x93886649b07888129fa320eb95756C35CF80d732"
const HOT_V1 = "0x8a8035F056af830B7205c58c1dC037f826fc2B92"
const realV2: V2Delegation = { type_: 3, from: VAULT_V2, contract_: NORMIES, tokenId: BigInt(7141) }
const realV1All: V1Delegation = { type_: 1, vault: VAULT_V1, delegate: HOT_V1, contract_: ZERO, tokenId: BigInt(0) }
const v1 = (type_: number, over: Partial<V1Delegation> = {}): V1Delegation => ({ type_, vault: VAULT_V1, delegate: HOT_V1, contract_: NORMIES, tokenId: BigInt(0), ...over })
const v2 = (type_: number, over: Partial<V2Delegation> = {}): V2Delegation => ({ type_, from: VAULT_V2, contract_: NORMIES, tokenId: BigInt(0), ...over })
const holds = (map: Record<string, number[]>) => async (vault: string) => {
  const ids = map[vault.toLowerCase()]
  if (!ids) throw new Error("lookup failed")
  return ids
}

describe("the v1 reader matches the registry", () => {
  it("uses the field order the registry really returns (the old ABI had vault first and decoded garbage)", () => {
    const out = DELEGATE_REGISTRY_ABI[0].outputs[0].components.map((c) => c.name)
    assert.deepEqual(out, ["type_", "vault", "delegate", "contract_", "tokenId"])
  })
})

describe("claimsFromV1", () => {
  it("the real delegate-ALL delegation (contract_ is the zero address) covers Normies", () => {
    assert.deepEqual(claimsFromV1([realV1All]), [{ registry: "v1", vault: VAULT_V1, tokenId: null }])
  })
  it("CONTRACT counts only for the Normies contract; TOKEN counts only for Normies and names the token", () => {
    assert.equal(claimsFromV1([v1(2)]).length, 1)
    assert.equal(claimsFromV1([v1(2, { contract_: OTHER })]).length, 0)
    assert.deepEqual(claimsFromV1([v1(3, { tokenId: BigInt(7141) })]), [{ registry: "v1", vault: VAULT_V1, tokenId: 7141 }])
    assert.equal(claimsFromV1([v1(3, { contract_: OTHER, tokenId: BigInt(5) })]).length, 0)
  })
  it("NONE and a zero-address vault grant nothing", () => {
    assert.equal(claimsFromV1([v1(0), v1(1, { vault: ZERO })]).length, 0)
  })
})

describe("claimsFromV2", () => {
  it("the real ERC721 delegation of #7141 (0xfafd to 32626.eth)", () => {
    assert.deepEqual(claimsFromV2([realV2]), [{ registry: "v2", vault: VAULT_V2, tokenId: 7141 }])
  })
  it("ALL and Normies CONTRACT cover the vault; other collections and ERC20 / ERC1155 do not", () => {
    assert.equal(claimsFromV2([v2(1), v2(2)]).length, 2)
    assert.equal(claimsFromV2([v2(2, { contract_: OTHER }), v2(3, { contract_: OTHER, tokenId: BigInt(5) }), v2(4), v2(5, { tokenId: BigInt(7141) }), v2(0)]).length, 0)
  })
})

describe("resolveClaims", () => {
  it("accepts token ids as numeric strings, which is what api.normies.art returns", async () => {
    const r = await resolveClaims([{ registry: "v2", vault: VAULT_V2, tokenId: 7141 }, { registry: "v1", vault: VAULT_V1, tokenId: null }], async (v) => (v.toLowerCase() === VAULT_V2.toLowerCase() ? ["7141", "9"] : ["42"]))
    assert.deepEqual(r.entries.map((e) => e.tokenId), [42, 7141])
  })
  it("a whole-vault claim means everything the vault holds now, looked up once per vault", async () => {
    let calls = 0
    const holdersOf = async () => { calls++; return [7141, 9] }
    const r = await resolveClaims([{ registry: "v1", vault: VAULT_V2, tokenId: null }, { registry: "v2", vault: VAULT_V2, tokenId: null }], holdersOf)
    assert.deepEqual(r.entries.map((e) => e.tokenId), [9, 7141])
    assert.equal(calls, 1)
  })
  it("a single-token claim counts only while the vault still holds the token (stale delegations grant nothing)", async () => {
    const claims = [{ registry: "v2" as const, vault: VAULT_V2, tokenId: 7141 }]
    assert.deepEqual((await resolveClaims(claims, holds({ [VAULT_V2.toLowerCase()]: [7141] }))).entries.map((e) => e.tokenId), [7141])
    assert.deepEqual((await resolveClaims(claims, holds({ [VAULT_V2.toLowerCase()]: [1, 2] }))).entries, [])
  })
  it("when a vault's holdings cannot be read: a token claim is kept but marked unverified, a vault claim is reported as failed", async () => {
    const r = await resolveClaims(
      [{ registry: "v2", vault: VAULT_V2, tokenId: 7141 }, { registry: "v1", vault: VAULT_V1, tokenId: null }],
      holds({}),
    )
    assert.deepEqual(r.entries, [{ tokenId: 7141, vault: VAULT_V2, registry: "v2", verified: false }])
    assert.deepEqual(r.failedVaults, [VAULT_V1])
  })
  it("the same token from both registries is listed once, and the verified entry wins", async () => {
    const r = await resolveClaims(
      [{ registry: "v1", vault: VAULT_V2, tokenId: 7141 }, { registry: "v2", vault: VAULT_V2, tokenId: null }],
      holds({ [VAULT_V2.toLowerCase()]: [7141] }),
    )
    assert.equal(r.entries.length, 1)
    assert.equal(r.entries[0].verified, true)
  })
})

describe("findDelegateXyz", () => {
  const holders = holds({ [VAULT_V2.toLowerCase()]: [7141, 8000], [VAULT_V1.toLowerCase()]: [42, 43] })

  it("32626.eth (v2, one token) and a v1 delegate-ALL hot wallet are both found", async () => {
    const a = await findDelegateXyz(HOT_V2, { readV1: async () => [], readV2: async () => [realV2], holdersOf: holders })
    assert.deepEqual(a.entries.map((e) => [e.tokenId, e.registry]), [[7141, "v2"]])
    const b = await findDelegateXyz(HOT_V1, { readV1: async () => [realV1All], readV2: async () => [], holdersOf: holders })
    assert.deepEqual(b.entries.map((e) => [e.tokenId, e.registry]), [[42, "v1"], [43, "v1"]])
    assert.equal(delegationCheckIncomplete(a), false)
  })
  it("a wallet with delegations in BOTH registries gets both sets", async () => {
    const r = await findDelegateXyz(HOT_V1, { readV1: async () => [realV1All], readV2: async () => [realV2], holdersOf: holders })
    assert.deepEqual(r.entries.map((e) => e.tokenId), [42, 43, 7141])
  })
  it("one registry failing keeps what the other found, and says it could not check", async () => {
    const r = await findDelegateXyz(HOT_V2, { readV1: async () => { throw new Error("rpc") }, readV2: async () => [realV2], holdersOf: holders })
    assert.deepEqual(r.entries.map((e) => e.tokenId), [7141])
    assert.deepEqual(r.checked, { v1: false, v2: true })
    assert.equal(delegationCheckIncomplete(r), true)
  })
  it("both failing is UNKNOWN, never an empty fact, and never throws", async () => {
    const r = await findDelegateXyz(HOT_V2, { readV1: async () => { throw new Error("rpc") }, readV2: async () => { throw new Error("rpc") }, holdersOf: holders })
    assert.deepEqual(r.entries, [])
    assert.deepEqual(r.checked, { v1: false, v2: false })
    assert.equal(delegationCheckIncomplete(r), true)
  })
  it("a clean 'no delegations' answer is complete", async () => {
    const r = await findDelegateXyz(HOT_V2, { readV1: async () => [], readV2: async () => [], holdersOf: holders })
    assert.equal(delegationCheckIncomplete(r), false)
    assert.deepEqual(r.entries, [])
  })
})
