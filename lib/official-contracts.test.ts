import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { checkContract, OFFICIAL_CONTRACTS, parseAddressInput } from "./official-contracts"

describe("official contracts (normies.art/docs list)", () => {
  it("knows the market, canvas and pixel storage, case-insensitively", () => {
    assert.equal(OFFICIAL_CONTRACTS.size, 24)
    const m = checkContract("0x86156A8D6E4B9925F7FECA527EA5D71B0DEEDB64")
    assert.equal(m.official && m.contract.name, "NormiesPixelMarket")
    assert.equal(checkContract("0xf14f2852e1fd6a4108156054af49b3915dc40e2e").official, true)
    assert.equal(checkContract("0x96F2DA32Bb9D429d59ac13dB469f4950cBe02084").official, true)
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
