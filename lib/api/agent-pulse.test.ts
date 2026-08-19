import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  USAGE_BREAKDOWN_SIGNAL,
  assemblePulseSignals,
} from "./agent-pulse"

const FOUR = [
  "ERC-8004 registered",
  "Has active agent card",
  "Canvas activity detected",
  "Clean ownership & delegation",
]

describe("assemblePulseSignals", () => {
  it("caps at 4 without usage", () => {
    const p = assemblePulseSignals(FOUR, false)
    assert.equal(p.pulse_level, 4)
    assert.equal(p.status, "Strong")
    assert.ok(p.next_signal)
    assert.equal(p.breakdown.includes(USAGE_BREAKDOWN_SIGNAL), false)
  })

  it("reaches Luminous when usage is earned on four static signals", () => {
    const p = assemblePulseSignals(FOUR, true)
    assert.equal(p.pulse_level, 5)
    assert.equal(p.status, "Luminous")
    assert.equal(p.next_signal, null)
    assert.ok(p.breakdown.includes(USAGE_BREAKDOWN_SIGNAL))
    assert.match(p.note, /usage/i)
    assert.doesNotMatch(p.note, /reserved/i)
  })

  it("does not jump a 3-signal agent to 5 from usage alone", () => {
    const p = assemblePulseSignals(FOUR.slice(0, 3), true)
    assert.equal(p.pulse_level, 4)
    assert.equal(p.status, "Strong")
  })
})
