import assert from "node:assert/strict"
import { test } from "node:test"

import { isAgentsCanvasLive, pendingCanvasSector } from "./canvas"

const AT = "2026-10-19T00:00:00.000Z"

test("announced, not live: every field pending, never a number, never ranked", () => {
  const s = pendingCanvasSector(AT, "ANNOUNCED")
  assert.equal(s.status, "announced")
  assert.match(s.status_text, /not live/)
  for (const f of Object.values(s.record)) {
    assert.equal(f.value, null)
    assert.equal(f.label, "pending")
  }
  assert.equal(s.rank.ranked, false)
})

test("once LIVE without an adapter it says source pending, still no numbers", () => {
  const s = pendingCanvasSector(AT, "LIVE")
  assert.equal(s.status, "source_pending")
  assert.ok(Object.values(s.record).every((f) => f.value === null && f.label === "pending"))
})

test("only LIVE counts as live", () => {
  for (const st of ["ANNOUNCED", "TEASER", "COMING_SOON", ""]) assert.equal(isAgentsCanvasLive(st), false)
  assert.equal(isAgentsCanvasLive("LIVE"), true)
})
