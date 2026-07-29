import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  ERC6551_REGISTRY,
  TOKENBOUND_ACCOUNT_PROXY,
  TOKENBOUND_V3_DEFAULTS,
  assertSafeTbaDeposit,
  buildTokenBoundBinding,
  createDisabledAccountProvider,
  createTokenboundAccountProvider,
  encodeCreateAccountCall,
  getZuloAccountPlane,
  isSelfOwnershipCycle,
} from "./index"

describe("ERC-6551 constants", () => {
  it("uses the EIP-mandated singleton registry", () => {
    assert.equal(
      ERC6551_REGISTRY.toLowerCase(),
      "0x000000006551c19487814612e58fe06813775758",
    )
  })

  it("defaults Tokenbound V3 proxy as implementation", () => {
    assert.equal(
      TOKENBOUND_V3_DEFAULTS.implementation,
      TOKENBOUND_ACCOUNT_PROXY,
    )
  })
})

describe("TokenBoundBinding + createAccount encode", () => {
  it("builds binding with defaults and encodes createAccount", () => {
    const binding = buildTokenBoundBinding({
      chainId: 1,
      tokenContract: "0x9eb6e2025b64f340691e424b7fe7022ffde12438",
      tokenId: 7141,
    })
    assert.equal(binding.chainId, 1)
    assert.equal(binding.tokenId, BigInt(7141))
    assert.equal(
      binding.implementation.toLowerCase(),
      TOKENBOUND_ACCOUNT_PROXY.toLowerCase(),
    )

    const call = encodeCreateAccountCall(binding)
    assert.equal(call.to.toLowerCase(), ERC6551_REGISTRY.toLowerCase())
    assert.equal(call.functionName, "createAccount")
    assert.equal(call.args[4], BigInt(7141))
    assert.ok(call.data.startsWith("0x"))
  })
})

describe("ownership cycle guards", () => {
  const binding = buildTokenBoundBinding({
    chainId: 1,
    tokenContract: "0x9eb6e2025b64f340691e424b7fe7022ffde12438",
    tokenId: 7141,
  })

  it("detects depth-1 self-ownership cycle", () => {
    assert.equal(
      isSelfOwnershipCycle({
        account: "0x1111111111111111111111111111111111111111",
        nftContract: binding.tokenContract,
        nftTokenId: BigInt(7141),
        binding,
      }),
      true,
    )
  })

  it("allows depositing a different NFT into the TBA", () => {
    assert.equal(
      isSelfOwnershipCycle({
        account: "0x1111111111111111111111111111111111111111",
        nftContract: binding.tokenContract,
        nftTokenId: BigInt(42),
        binding,
      }),
      false,
    )
  })

  it("assertSafeTbaDeposit throws on self-cycle", () => {
    const provider = createTokenboundAccountProvider({ status: "scaffold" })
    assert.throws(() =>
      assertSafeTbaDeposit({
        provider,
        account: "0x1111111111111111111111111111111111111111",
        nftContract: binding.tokenContract,
        nftTokenId: BigInt(7141),
        binding,
      }),
    )
  })
})

describe("AccountProvider plug-in", () => {
  it("disabled provider rejects resolve", async () => {
    const p = createDisabledAccountProvider()
    assert.equal(p.status, "disabled")
    await assert.rejects(() =>
      p.resolveAccount({
        chainId: 1,
        tokenContract: "0x9eb6e2025b64f340691e424b7fe7022ffde12438",
        tokenId: 7141,
      }),
    )
  })

  it("Tokenbound provider encodes create without a client", () => {
    const p = createTokenboundAccountProvider({ status: "scaffold" })
    assert.equal(p.id, "tokenbound-v3")
    const encoded = p.encodeCreateAccount?.({
      chainId: 1,
      tokenContract: "0x9eb6e2025b64f340691e424b7fe7022ffde12438",
      tokenId: 7141,
    })
    assert.ok(encoded)
    assert.equal(encoded!.to.toLowerCase(), ERC6551_REGISTRY.toLowerCase())
  })
})

describe("Zulo account plane", () => {
  it("keeps ERC-8004 identity separate from TBA provider", () => {
    const plane = getZuloAccountPlane("disabled")
    assert.equal(plane.identity.kind, "erc8004-normie")
    assert.equal(plane.identity.tokenId, 7141)
    assert.equal(plane.identity.agentId, 32626)
    assert.equal(plane.accountProvider.status, "disabled")
    assert.ok(plane.controlModes.includes("erc721-owner"))
    assert.ok(!plane.controlModes.includes("erc6551-signer"))
  })

  it("scaffold adds erc6551-signer control mode", () => {
    const plane = getZuloAccountPlane("scaffold")
    assert.equal(plane.accountProvider.status, "scaffold")
    assert.ok(plane.controlModes.includes("erc6551-signer"))
  })
})
