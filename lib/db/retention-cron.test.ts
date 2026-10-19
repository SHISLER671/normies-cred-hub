import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { test } from "node:test"

import { runRetentionCron } from "./retention-cron"

const ok = async () => ({ ok: true })

test("runs the purge for the cron's bearer secret", async () => {
  let ran = 0
  const r = await runRetentionCron("Bearer s3cret", "s3cret", async () => { ran++; return { ok: true } })
  assert.equal(r.status, 200)
  assert.equal(ran, 1)
})

test("refuses anyone without the secret, and refuses everyone when no secret is set", async () => {
  let ran = 0
  const count = async () => { ran++; return { ok: true } }
  for (const [auth, secret] of [[null, "s3cret"], ["Bearer wrong", "s3cret"], ["Bearer ", ""], ["Bearer x", undefined]] as const) {
    assert.equal((await runRetentionCron(auth, secret, count)).status, 401)
  }
  assert.equal(ran, 0)
})

test("a failed or throwing delete is reported as a failed run, never as ok", async () => {
  assert.equal((await runRetentionCron("Bearer s", "s", async () => ({ ok: false }))).status, 503)
  const thrown = await runRetentionCron("Bearer s", "s", async () => { throw new Error("db down") })
  assert.equal(thrown.status, 503)
  assert.doesNotMatch(JSON.stringify(thrown.body), /db down/)
  assert.equal((await runRetentionCron("Bearer s", "s", ok)).body.ok, true)
})

test("scheduled in vercel.json on its own, not inside another cron", () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, "../../vercel.json"), "utf8"))
  const paths = (cfg.crons as { path: string }[]).map((c) => c.path)
  assert.ok(paths.includes("/api/cron/retention"))
  const watch = fs.readFileSync(path.join(__dirname, "../../app/api/zulo/canvas-watch/route.ts"), "utf8")
  assert.doesNotMatch(watch, /purgeExpiredRows/)
})
