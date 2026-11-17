import { describe, it } from "node:test"
import assert from "node:assert/strict"

import fs from "node:fs"

import { checkContract, OFFICIAL_CONTRACTS, parseAddressInput } from "./official-contracts"
import { ARENA_STORAGE_CONTRACT, ARENA_STORAGE_CONTRACT_V1 } from "./official-status"

describe("official contracts (normies.art/docs list)", () => {
  it("knows the market, canvas and pixel storage, case-insensitively", () => {
    assert.equal(OFFICIAL_CONTRACTS.size, 32)
    const m = checkContract("0x86156A8D6E4B9925F7FECA527EA5D71B0DEEDB64")
    assert.equal(m.official && m.contract.name, "NormiesPixelMarket")
    assert.equal(checkContract("0xf14f2852e1fd6a4108156054af49b3915dc40e2e").official, true)
    assert.equal(checkContract("0x96F2DA32Bb9D429d59ac13dB469f4950cBe02084").official, true)
  })
  it("knows the current Arena storage contract, and it matches the address the official status names", () => {
    const a = checkContract("0x235403069C8516369EB36D29BB1A498A469AB9F0")
    assert.equal(a.official && a.contract.name, "NormiesArenaStorage")
    assert.equal(a.official && a.contract.role, "Arena balances, registrations, rounds and results (read-only for NCH)")
    assert.equal(ARENA_STORAGE_CONTRACT, a.address)
  })
  it("knows every Arena contract in the official API docs (llms.txt, read 2026-11-17), v2 ones labelled retired", () => {
    const want: Array<[string, string]> = [
      ["0x821D175F6b1B271bA3c62E63270157e6Ad48018B", "NormiesArena"],
      ["0x5E7A4410375Ce710C04957aa9Ae33467ffD1f9d0", "NormiesArenaQueue"],
      ["0x3F298B7b7d5300Aab34a22470b8d1d54b8b30A05", "NormiesArenaSkins"],
      ["0x6A80F157BFC981098132c344Ee4879f8E8CF1d22", "NormiesArena (retired)"],
      ["0xEAB672382b3d717F84352C0A63ae264C6A31b903", "NormiesArenaQueue (retired)"],
      ["0xaF3060dBdb4E789163Babf4AFc3CE1ddAD82a0cB", "NormiesArenaSkins (retired)"],
    ]
    for (const [address, name] of want) {
      const c = checkContract(address)
      assert.equal(c.official && c.contract.name, name, address)
    }
  })
  it("still knows the retired launch-weekend Arena storage, labelled retired", () => {
    const old = checkContract("0x980D97E7B77CD204707DAEDA6C9E51FBCAE84E1E")
    assert.equal(old.official && old.contract.name, "NormiesArenaStorage (retired)")
    assert.equal(ARENA_STORAGE_CONTRACT_V1, old.address)
    // The pinned /arena/status response is from launch weekend, so it names the retired contract.
    assert.equal(JSON.parse(fs.readFileSync("lib/record-card/fixtures/arena-status.json", "utf8")).storage, ARENA_STORAGE_CONTRACT_V1)
  })
  it("anything else is not official", () => {
    assert.equal(checkContract("0x446d014348a3ef98fd7a91cc1184d4d4a755789f").official, false)
  })
  it("reads an address or a link with exactly one address in it", () => {
    assert.equal(parseAddressInput(" 0x86156A8d6e4B9925F7fEca527ea5D71B0deeDB64 "), "0x86156a8d6e4b9925f7feca527ea5d71b0deedb64")
    assert.equal(parseAddressInput("https://etherscan.io/address/0x86156A8d6e4B9925F7fEca527ea5D71B0deeDB64#code"), "0x86156a8d6e4b9925f7feca527ea5d71b0deedb64")
    assert.equal(parseAddressInput("0x86156A8d6e4B9925F7fEca527ea5D71B0deeDB64 and 0x96F2DA32Bb9D429d59ac13dB469f4950cBe02084"), null)
    assert.equal(parseAddressInput("0x1234"), null)
    assert.equal(parseAddressInput("0xa046d322d8134eb05a0a754f495979a9f501873e41a4136f786edfa3754d4473"), null)
  })
})
