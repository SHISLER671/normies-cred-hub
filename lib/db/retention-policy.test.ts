import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { test } from "node:test"

import { RATINGS_RETENTION_DAYS, retentionCutoff } from "./retention-policy"

test("ratings are kept 180 days", () => {
  assert.equal(RATINGS_RETENTION_DAYS, 180)
  assert.equal(retentionCutoff(new Date("2026-10-19T00:00:00Z"), 180), "2026-04-22T00:00:00.000Z")
})

test("refuses a zero, negative or fractional window (a typo must not wipe the table)", () => {
  for (const bad of [0, -1, 1.5, NaN]) assert.throws(() => retentionCutoff(new Date(), bad))
})

test("/privacy states the ratings retention", () => {
  const page = fs.readFileSync(path.join(__dirname, "../../app/privacy/page.tsx"), "utf8")
  const ratings = page.slice(page.indexOf("<strong>Ratings</strong>"), page.indexOf("</li>", page.indexOf("<strong>Ratings</strong>")))
  assert.match(ratings, new RegExp(`Deleted after ${RATINGS_RETENTION_DAYS} days`))
})
