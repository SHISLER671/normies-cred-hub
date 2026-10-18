import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { test } from "node:test"

import { beatSegmentPath, PULSE_BEATS, pulseBeats } from "./beats"
import { GATE_CLEAN_OWNERSHIP, GATE_REGISTERED } from "../record-card/build"

test("every beat signal string exists verbatim in the Pulse calculator", () => {
  const src = fs.readFileSync(path.join(__dirname, "../api/agent-pulse.ts"), "utf8")
  for (const b of PULSE_BEATS) assert.ok(src.includes(`"${b.signal}"`), `missing in agent-pulse.ts: ${b.signal}`)
})

test("five beats, and the two gate beats are exactly the trust gate checks", () => {
  assert.equal(PULSE_BEATS.length, 5)
  assert.deepEqual(
    PULSE_BEATS.filter((b) => b.gate).map((b) => b.signal).sort(),
    [GATE_CLEAN_OWNERSHIP, GATE_REGISTERED].sort(),
  )
})

test("lights only what the breakdown contains; ignores unknown strings", () => {
  const lit = pulseBeats([GATE_REGISTERED, "Something new", GATE_CLEAN_OWNERSHIP]).map((b) => b.lit)
  assert.deepEqual(lit, [true, false, false, true, false])
  assert.deepEqual(pulseBeats(null).map((b) => b.lit), [false, false, false, false, false])
})

test("trace segments stay inside the 500×100 box and join end to end", () => {
  for (let i = 0; i < 5; i++) {
    for (const lit of [true, false]) {
      const d = beatSegmentPath(i, lit)
      assert.ok(d.startsWith(`M${i * 100} 60`))
      assert.ok(d.endsWith(`${i * 100 + 100} 60`))
      for (const [, x, y] of d.matchAll(/(\d+) (\d+)/g)) {
        assert.ok(+x >= 0 && +x <= 500 && +y >= 0 && +y <= 100)
      }
    }
  }
})
