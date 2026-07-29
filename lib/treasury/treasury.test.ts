import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"

import { ZULO_IDENTITY } from "@/lib/agent-recommendations/constants"

import {
  createHotWalletReceiver,
  getPaymentReceiver,
  getPaymentReceiverMode,
  getTipAssetsByPriority,
  tipAssetPriorityIds,
} from "./index"

const prevReceiver = process.env.ZULO_PAYMENT_RECEIVER

afterEach(() => {
  if (prevReceiver === undefined) delete process.env.ZULO_PAYMENT_RECEIVER
  else process.env.ZULO_PAYMENT_RECEIVER = prevReceiver
})

describe("tip asset priority", () => {
  it("orders canvas-ap → x402-usdc → eth-mainnet → eth-base", () => {
    assert.deepEqual(tipAssetPriorityIds(), [
      "canvas-ap",
      "x402-usdc",
      "eth-mainnet",
      "eth-base",
    ])
    const sorted = getTipAssetsByPriority()
    assert.equal(sorted[0]?.id, "canvas-ap")
    assert.equal(sorted[0]?.verification, "normies-a2a-oracle")
    assert.equal(sorted[1]?.id, "x402-usdc")
  })
})

describe("payment receiver factory", () => {
  it("defaults to hot-wallet", () => {
    delete process.env.ZULO_PAYMENT_RECEIVER
    assert.equal(getPaymentReceiverMode(), "hot-wallet")
    const adapter = getPaymentReceiver()
    assert.equal(adapter.id, "hot-wallet")
    assert.equal(adapter.status, "live")
  })

  it("selects TBA when ZULO_PAYMENT_RECEIVER=tba", () => {
    process.env.ZULO_PAYMENT_RECEIVER = "tba"
    assert.equal(getPaymentReceiverMode(), "erc6551-tba")
    const adapter = getPaymentReceiver()
    assert.equal(adapter.id, "erc6551-tba")
  })
})

describe("HotWalletReceiver", () => {
  it("returns Zulo hot wallet address", async () => {
    const hw = createHotWalletReceiver()
    const addr = await hw.getReceiverAddress()
    assert.equal(addr.toLowerCase(), ZULO_IDENTITY.hotWallet.toLowerCase())
  })

  it("ignores tokenId for hot wallet", async () => {
    const hw = createHotWalletReceiver()
    const a = await hw.getReceiverAddress({ tokenId: 1 })
    const b = await hw.getReceiverAddress({ tokenId: 9999 })
    assert.equal(a, b)
  })
})

describe("adapter interface consistency", () => {
  it("both adapters expose getReceiverAddress", async () => {
    delete process.env.ZULO_PAYMENT_RECEIVER
    const hot = getPaymentReceiver("hot-wallet")
    const tba = getPaymentReceiver("erc6551-tba")
    assert.equal(typeof hot.getReceiverAddress, "function")
    assert.equal(typeof tba.getReceiverAddress, "function")
    const hotAddr = await hot.getReceiverAddress()
    assert.ok(hotAddr.startsWith("0x"))
    assert.equal(hotAddr.length, 42)
  })
})
