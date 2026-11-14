import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { test } from "node:test"

import { beatPixels, PIXEL_BASELINE, PIXEL_COLS, PIXEL_COLS_PER_BEAT, PIXEL_ROWS, pixelPath, popularityCountsText, PULSE_BEATS, PULSE_MAX_LEVEL, pulseBeats, TRENDING_LABEL } from "./beats"
import { TRUST_SIGNALS } from "../api/agent-pulse"
import { GATE_CLEAN_OWNERSHIP, GATE_REGISTERED } from "../record-card/build"

test("every beat signal string exists verbatim in the Pulse calculator", () => {
  const src = fs.readFileSync(path.join(__dirname, "../api/agent-pulse.ts"), "utf8")
  for (const b of PULSE_BEATS) assert.ok(src.includes(`"${b.signal}"`), `missing in agent-pulse.ts: ${b.signal}`)
})

test("four beats, one per trust check and no popularity beat; the two gate beats are exactly the trust gate checks", () => {
  assert.equal(PULSE_BEATS.length, 4)
  assert.equal(PULSE_MAX_LEVEL, 4)
  assert.equal(PIXEL_COLS, 80)
  assert.deepEqual(PULSE_BEATS.map((b) => b.signal), [...TRUST_SIGNALS])
  for (const b of PULSE_BEATS) assert.doesNotMatch(`${b.label} ${b.meaning}`, /popular|trending/i, b.signal)
  assert.deepEqual(
    PULSE_BEATS.filter((b) => b.gate).map((b) => b.signal).sort(),
    [GATE_CLEAN_OWNERSHIP, GATE_REGISTERED].sort(),
  )
})

test("lights only what the breakdown contains; ignores unknown strings", () => {
  const lit = pulseBeats([GATE_REGISTERED, "Something new", GATE_CLEAN_OWNERSHIP]).map((b) => b.lit)
  assert.deepEqual(lit, [true, false, false, true])
  assert.deepEqual(pulseBeats(null).map((b) => b.lit), [false, false, false, false])
  // The old fifth-level string lights nothing.
  assert.deepEqual(pulseBeats(['Recent agent usage / interaction signal']).map((b) => b.lit), [false, false, false, false])
})

test("pixel beats stay inside the 80 × 24 grid, one beat per 20 columns", () => {
  for (let i = 0; i < PULSE_BEATS.length; i++) {
    for (const lit of [true, false]) {
      const px = beatPixels(i, lit)
      assert.ok(px.length > 0)
      for (const [x, y] of px) {
        assert.ok(x >= i * PIXEL_COLS_PER_BEAT && x < (i + 1) * PIXEL_COLS_PER_BEAT, `x ${x} outside beat ${i}`)
        assert.ok(y >= 0 && y < PIXEL_ROWS, `y ${y} outside grid`)
      }
    }
  }
})

test("an earned beat is one connected line: every column has a pixel and it spikes", () => {
  const px = beatPixels(0, true)
  const cols = new Set(px.map(([x]) => x))
  for (let c = 0; c < PIXEL_COLS_PER_BEAT; c++) assert.ok(cols.has(c), `gap at column ${c}`)
  const rows = px.map(([, y]) => y)
  assert.ok(Math.min(...rows) <= 3 && Math.max(...rows) >= 20, "spike reaches near top and bottom")
})

test("a missing beat is a dotted baseline", () => {
  const px = beatPixels(2, false)
  assert.ok(px.every(([x, y]) => y === PIXEL_BASELINE && x % 2 === 0))
  assert.equal(pixelPath([[3, 4]]), "M3 4h1v1h-1z")
})

test("Pulse check wording never says 'earned' (a passed check earns nothing, least of all PIXEL)", () => {
  for (const b of PULSE_BEATS) {
    assert.doesNotMatch(`${b.label} ${b.meaning}`, /\bearn(s|ed|ing)?\b/i, b.signal)
  }
  const trace = fs.readFileSync(path.join(__dirname, "../../components/pulse-trace.tsx"), "utf8")
  assert.doesNotMatch(trace, /\bearned\b/i, "components/pulse-trace.tsx")
})

test("the trending badge copy: plain words, people and days, both counts", () => {
  assert.equal(TRENDING_LABEL, "Trending on NCH")
  assert.equal(popularityCountsText({ pulse_checkers: 12, paths_users: 4, lookback_days: 14 }), "Checked by 12 people, used in Paths by 4, in the last 14 days")
  assert.equal(popularityCountsText({ pulse_checkers: 1, paths_users: 0, lookback_days: 14 }), "Checked by 1 person, used in Paths by 0, in the last 14 days")
})

test("the heartbeat's stylesheet matches the four-beat grid", () => {
  const css = fs.readFileSync(path.join(__dirname, "../../app/zulo/styles.css"), "utf8")
  assert.match(css, /\.ph-beats \{[^}]*grid-template-columns: repeat\(4, /)
  assert.match(css, /\.ph-trace-svg \{[^}]*aspect-ratio: 80 \/ 24;/)
})
