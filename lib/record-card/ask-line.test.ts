import assert from "node:assert/strict"
import { test } from "node:test"

import { recordCardLine, recordCardUrl } from "./ask-line"
import { GATE_CLEAN_OWNERSHIP, GATE_REGISTERED } from "./build"

const ORIGIN = "https://normiescredhub.vercel.app/"

test("record card url trims a trailing slash", () => {
  assert.equal(recordCardUrl(1217, ORIGIN), "https://normiescredhub.vercel.app/record/1217")
})

test("passing gate + Arena not open → pending Arena line", () => {
  const line = recordCardLine(7141, [GATE_REGISTERED, GATE_CLEAN_OWNERSHIP], ORIGIN, "TEASER")
  assert.match(line, /\/record\/7141/)
  assert.match(line, /Passes the trust gate/)
  assert.match(line, /Arena record: pending/)
})

test("missing checks are named in plain words", () => {
  const line = recordCardLine(1217, [], ORIGIN, "TEASER")
  assert.match(line, /Not yet past the trust gate: needs registered on-chain and clean ownership/)
})

test("never claims an Arena record while Arena is not LIVE", () => {
  for (const status of ["TEASER", "PLANNED", "", "COMING_SOON"]) {
    assert.doesNotMatch(recordCardLine(1, null, ORIGIN, status), /official data only/)
  }
  assert.match(recordCardLine(1, null, ORIGIN, "LIVE"), /official data only/)
})
