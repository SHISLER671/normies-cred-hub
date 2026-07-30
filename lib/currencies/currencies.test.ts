import assert from "node:assert/strict"
import { describe, it, afterEach } from "node:test"

import {
  CURRENCIES,
  CURRENCY_CODES,
  convertCurrency,
  displayCurrencyLabel,
  formatCurrencyAmount,
  getConversionMode,
  isCurrencyCode,
} from "./index"

describe("CURRENCIES registry", () => {
  it("defines AP and PIXEL with required fields", () => {
    assert.equal(CURRENCIES.AP.symbol, "AP")
    assert.equal(CURRENCIES.AP.name, "Action Points")
    assert.equal(CURRENCIES.AP.decimals, 0)
    assert.equal(CURRENCIES.AP.tradable, false)

    assert.equal(CURRENCIES.PIXEL.symbol, "PIXEL")
    assert.equal(CURRENCIES.PIXEL.name, "Pixel")
    assert.equal(CURRENCIES.PIXEL.tradable, true)
    assert.equal(CURRENCIES.PIXEL.legacyAlias, "AP")
  })

  it("lists AP first for discovery order", () => {
    assert.deepEqual([...CURRENCY_CODES], ["AP", "PIXEL"])
  })

  it("type-guards currency codes", () => {
    assert.equal(isCurrencyCode("AP"), true)
    assert.equal(isCurrencyCode("PIXEL"), true)
    assert.equal(isCurrencyCode("ETH"), false)
  })
})

describe("convertCurrency", () => {
  const prevMode = process.env.PIXEL_CONVERSION_MODE
  const prevRate = process.env.PIXEL_AP_ORACLE_RATE

  afterEach(() => {
    if (prevMode === undefined) delete process.env.PIXEL_CONVERSION_MODE
    else process.env.PIXEL_CONVERSION_MODE = prevMode
    if (prevRate === undefined) delete process.env.PIXEL_AP_ORACLE_RATE
    else process.env.PIXEL_AP_ORACLE_RATE = prevRate
  })

  it("identity when from === to", () => {
    const r = convertCurrency(5, "AP", "AP")
    assert.equal(r.amountOut, 5)
    assert.equal(r.status, "identity")
    assert.equal(r.rate, 1)
  })

  it("defaults to 1:1 same-unit AP ↔ PIXEL", () => {
    delete process.env.PIXEL_CONVERSION_MODE
    const r = convertCurrency(10, "AP", "PIXEL")
    assert.equal(getConversionMode(), "same-unit")
    assert.equal(r.amountOut, 10)
    assert.equal(r.rate, 1)
    assert.equal(r.status, "placeholder")
  })

  it("oracle mode uses placeholder rate", () => {
    process.env.PIXEL_CONVERSION_MODE = "oracle"
    process.env.PIXEL_AP_ORACLE_RATE = "2"
    const r = convertCurrency(3, "AP", "PIXEL")
    assert.equal(r.amountOut, 6)
    assert.equal(r.rate, 2)
    assert.equal(r.status, "placeholder")
  })

  it("rejects invalid amounts", () => {
    const r = convertCurrency(-1, "AP", "PIXEL")
    assert.equal(r.amountOut, 0)
    assert.equal(r.note, "invalid amount")
  })
})

describe("display helpers", () => {
  it("formats integer AP amounts", () => {
    assert.equal(formatCurrencyAmount(12, "AP"), "12 AP")
    assert.equal(
      formatCurrencyAmount(12, "PIXEL", { preferPrimaryTerm: true }),
      "12 Pixel",
    )
  })

  it("uses AP label when Pixel disabled", () => {
    assert.equal(displayCurrencyLabel("PIXEL", false), "AP")
  })

  it("uses Pixel (AP) dual label when enabled", () => {
    assert.equal(displayCurrencyLabel("AP", true), "Pixel (AP)")
  })
})
