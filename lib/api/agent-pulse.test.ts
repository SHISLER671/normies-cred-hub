import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  MAX_LEVEL,
  NEXT_SIGNAL_LUMINOUS,
  TRUST_SIGNALS,
  USAGE_BREAKDOWN_SIGNAL,
  assemblePulseSignals,
} from "./agent-pulse"

const FOUR = [...TRUST_SIGNALS]

describe("assemblePulseSignals: levels 1–4 are trust, Luminous is popularity on top", () => {
  it("four trust checks without popularity is 4 (Strong) and points to Luminous", () => {
    const p = assemblePulseSignals(FOUR, false)
    assert.equal(p.pulse_level, 4)
    assert.equal(p.status, "Strong")
    assert.equal(p.next_signal, NEXT_SIGNAL_LUMINOUS)
    assert.equal(p.breakdown.includes(USAGE_BREAKDOWN_SIGNAL), false)
  })

  it("four trust checks plus popularity reaches Luminous", () => {
    const p = assemblePulseSignals(FOUR, true)
    assert.equal(MAX_LEVEL, 5)
    assert.equal(p.pulse_level, 5)
    assert.equal(p.status, "Luminous")
    assert.equal(p.next_signal, null)
    assert.ok(p.breakdown.includes(USAGE_BREAKDOWN_SIGNAL))
    assert.match(p.note, /popularity/i)
  })

  it("popularity never stands in for a missing trust check", () => {
    const p = assemblePulseSignals(FOUR.slice(0, 3), true)
    assert.equal(p.pulse_level, 3)
    assert.equal(p.status, "Solid")
    assert.equal(p.breakdown.includes(USAGE_BREAKDOWN_SIGNAL), false)
    assert.equal(p.next_signal, "Still missing: Clean ownership & delegation.")
  })

  it("a usage string passed in is ignored; only the popularity flag counts", () => {
    const p = assemblePulseSignals([...FOUR, USAGE_BREAKDOWN_SIGNAL], false)
    assert.equal(p.pulse_level, 4)
  })

  it("names the missing checks in test order and ignores unknown signals", () => {
    const p = assemblePulseSignals(["Clean ownership & delegation", "Something new", "ERC-8004 registered"], false)
    assert.equal(p.pulse_level, 2)
    assert.equal(p.status, "Building")
    assert.deepEqual(p.breakdown, ["ERC-8004 registered", "Clean ownership & delegation"])
    assert.equal(p.next_signal, "Still missing: Has active agent card, Canvas activity detected.")
  })
})

describe("parseTokenId (strict)", () => {
  it("accepts whole numbers 0–9999, as numbers or digit strings", async () => {
    const { parseTokenId } = await import("./agent-pulse")
    assert.equal(parseTokenId(7141), 7141)
    assert.equal(parseTokenId("7141"), 7141)
    assert.equal(parseTokenId("0"), 0)
    assert.equal(parseTokenId("07141"), 7141)
    assert.equal(parseTokenId(" 42 "), 42)
  })
  it("refuses junk that parseInt used to let through", async () => {
    const { parseTokenId } = await import("./agent-pulse")
    for (const bad of ["7141abc", "1e3", "12.9", 1.5, "", "-1", -1, 10000, "10000", true, null, undefined, "0x1f", NaN]) {
      assert.equal(parseTokenId(bad), null, String(bad))
    }
  })
})
