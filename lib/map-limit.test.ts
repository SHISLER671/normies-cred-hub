import assert from "node:assert/strict"
import { test } from "node:test"

import { mapLimit } from "./map-limit"

test("keeps order and never exceeds the limit", async () => {
  let inFlight = 0
  let peak = 0
  const out = await mapLimit([5, 1, 4, 2, 3, 0, 6], 3, async (n) => {
    inFlight++
    peak = Math.max(peak, inFlight)
    await new Promise((r) => setTimeout(r, n))
    inFlight--
    return n * 10
  })
  assert.deepEqual(out, [50, 10, 40, 20, 30, 0, 60])
  assert.ok(peak <= 3)
})

test("empty input and limit above length are fine", async () => {
  assert.deepEqual(await mapLimit([], 8, async (x: number) => x), [])
  assert.deepEqual(await mapLimit([1, 2], 50, async (x) => x + 1), [2, 3])
})
