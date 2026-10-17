import { describe, it } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const walk = (dir: string, out: string[] = []): string[] => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next", ".git", "supabase"].includes(e.name)) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\./.test(e.name)) out.push(p)
  }
  return out
}

describe("the service-role key stays on the server", () => {
  const files = [...walk("app"), ...walk("components"), ...walk("hooks"), ...walk("lib")]
  it("no client component or hook imports the database module", () => {
    const offenders = files.filter((f) => {
      const src = fs.readFileSync(f, "utf8")
      return /^["']use client["']/m.test(src.slice(0, 200)) && /lib\/db\/supabase/.test(src)
    })
    assert.deepEqual(offenders, [])
  })
  it("the service-role key is read from a server-only variable, never a NEXT_PUBLIC one", () => {
    for (const f of files) {
      const src = fs.readFileSync(f, "utf8")
      assert.doesNotMatch(src, /NEXT_PUBLIC_[A-Z_]*SERVICE_ROLE/, f)
    }
  })
  it("the floor, burn and workflow tables are only reached through the private client", () => {
    const src = fs.readFileSync("lib/db/supabase.ts", "utf8")
    for (const fn of [
      "saveFloorPrice",
      "getHistoricalFloor",
      "getBurnOpportunities",
      "saveBurnOpportunity",
      "logWorkflowRun",
      // recommendation_feedback holds wallets + intents: server-only since 2026-10-18
      "saveRecommendationFeedback",
      "getZuloHelpfulStats",
      "getRecommendationFeedbackRows",
    ]) {
      const body = src.slice(src.indexOf("export async function " + fn), src.indexOf("export async function " + fn) + 700)
      assert.match(body, /getPrivateDb\(\)/, fn)
      assert.doesNotMatch(body.split(".from(")[0], /getSupabase\(\)/, fn)
    }
  })
})

describe("recommendation_feedback lockdown migration (draft, applied by hand)", () => {
  const sql = fs.readFileSync("supabase/sql/2026-10-18-recommendation-feedback-lockdown.sql", "utf8")
  it("drops the permissive anon policies and revokes anon/authenticated access", () => {
    assert.match(sql, /drop policy if exists allow_insert_feedback/)
    assert.match(sql, /drop policy if exists allow_select_feedback/)
    assert.match(sql, /revoke all on table public\.recommendation_feedback from anon, authenticated/)
    assert.doesNotMatch(sql.split("-- Rollback")[0]!, /create policy[\s\S]*to anon/i)
  })
  it("stores wallets as unverified by default", () => {
    assert.match(sql, /wallet_verified boolean not null default false/)
  })
  it("the original setup script no longer re-opens anon access", () => {
    const setup = fs.readFileSync("docs/sql/001_recommendation_feedback.sql", "utf8")
    assert.doesNotMatch(setup, /to anon/)
  })
})
