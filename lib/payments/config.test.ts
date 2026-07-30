import assert from "node:assert/strict"
import { describe, it, afterEach } from "node:test"

import {
  getAcceptedCurrencies,
  getDefaultCurrency,
  getFallbackCurrency,
  getManifestCurrencies,
  getPaymentCurrencyConfig,
  getPixelCurrencyStatus,
  isPixelCurrencyEnabled,
  resolveServiceCurrency,
} from "./config"

describe("payment currency config defaults", () => {
  const keys = [
    "PIXEL_CURRENCY_ENABLED",
    "DEFAULT_CURRENCY",
    "PIXEL_CURRENCY_STATUS",
    "PIXEL_CONVERSION_ORACLE",
  ] as const
  const saved: Record<string, string | undefined> = {}

  afterEach(() => {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]!
    }
  })

  function snapshotEnv() {
    for (const k of keys) {
      saved[k] = process.env[k]
    }
  }

  it("defaults: Pixel off, default AP, accepted AP only", () => {
    snapshotEnv()
    delete process.env.PIXEL_CURRENCY_ENABLED
    delete process.env.DEFAULT_CURRENCY

    assert.equal(isPixelCurrencyEnabled(), false)
    assert.equal(getDefaultCurrency(), "AP")
    assert.equal(getFallbackCurrency(), "AP")
    assert.deepEqual(getAcceptedCurrencies(), ["AP"])
    assert.deepEqual(getManifestCurrencies(), ["AP", "PIXEL"])
    assert.equal(getPixelCurrencyStatus(), "disabled")
    assert.equal(resolveServiceCurrency("PIXEL"), "AP")
  })

  it("when flag on: accepts AP and PIXEL; status scaffolded", () => {
    snapshotEnv()
    process.env.PIXEL_CURRENCY_ENABLED = "true"
    delete process.env.DEFAULT_CURRENCY
    delete process.env.PIXEL_CURRENCY_STATUS

    assert.equal(isPixelCurrencyEnabled(), true)
    assert.deepEqual(getAcceptedCurrencies(), ["AP", "PIXEL"])
    assert.equal(getPixelCurrencyStatus(), "scaffolded")
    assert.equal(getDefaultCurrency(), "AP")
    assert.equal(resolveServiceCurrency("PIXEL"), "PIXEL")
  })

  it("DEFAULT_CURRENCY=PIXEL only applies when flag on", () => {
    snapshotEnv()
    process.env.DEFAULT_CURRENCY = "PIXEL"
    process.env.PIXEL_CURRENCY_ENABLED = "false"
    assert.equal(getDefaultCurrency(), "AP")

    process.env.PIXEL_CURRENCY_ENABLED = "true"
    assert.equal(getDefaultCurrency(), "PIXEL")
  })

  it("getPaymentCurrencyConfig snapshot is consistent", () => {
    snapshotEnv()
    delete process.env.PIXEL_CURRENCY_ENABLED
    const cfg = getPaymentCurrencyConfig()
    assert.equal(cfg.defaultCurrency, "AP")
    assert.equal(cfg.fallbackCurrency, "AP")
    assert.equal(cfg.pixelCurrencyEnabled, false)
    assert.equal(cfg.conversionOracle, "planned")
    assert.ok(cfg.currencies.AP)
    assert.ok(cfg.currencies.PIXEL)
  })
})
