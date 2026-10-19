import assert from "node:assert/strict"
import { test } from "node:test"

import robots from "./robots"

const rules = () => {
  const r = robots().rules
  return Array.isArray(r) ? r[0] : r
}
const list = (v: string | string[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : [v])

test("robots allows the Symphony share card so X can fetch og:image", () => {
  assert.ok(list(rules().allow).includes("/api/symphony/card"))
})

test("robots still disallows /api/ in general", () => {
  assert.ok(list(rules().disallow).includes("/api/"))
  assert.ok(!list(rules().allow).includes("/api/"))
})

test("every symphony og:image path under /api/ is allowed", async () => {
  const fs = await import("node:fs")
  const src = fs.readFileSync(new URL("./symphony/page.tsx", import.meta.url), "utf8")
  const m = src.match(/`(\/api\/[^?`$]+)/)
  assert.ok(m, "symphony page image path not found")
  assert.ok(list(rules().allow).includes(m[1]))
})
