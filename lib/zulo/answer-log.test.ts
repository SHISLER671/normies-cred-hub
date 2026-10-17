import assert from "node:assert/strict"
import fs from "node:fs"
import { describe, it } from "node:test"

import { ANSWER_LOG_LIMITS, answerLogEnabled, buildAnswerLogRow } from "./answer-log-row"

describe("buildAnswerLogRow", () => {
  it("keeps only Zulo's own words and the public Normie id", () => {
    const answer = {
      recommendation: "Hold #7141; burn #5678 for pixels.",
      nextSteps: ["Check Pulse", "Compare the Pixel Market price"],
      confidence: 0.8,
      pulseLead: "Pulse 4/5 (Strong)",
      // Things the log must never keep, even if a caller passes them:
      userQuery: "my wallet is 0xabc…",
      userWallet: "0x1111111111111111111111111111111111111111",
      userEns: "someone.eth",
    } as Parameters<typeof buildAnswerLogRow>[0]
    const row = buildAnswerLogRow(answer, 7141)
    assert.ok(row)
    assert.deepEqual(Object.keys(row).sort(), ["confidence", "next_steps", "normie_id", "pulse_lead", "recommendation", "surface"])
    assert.equal(row.normie_id, 7141)
    assert.equal(row.surface, "ask")
    assert.doesNotMatch(JSON.stringify(row), /0x1111|someone\.eth|my wallet/)
  })

  it("joins a list recommendation and clips long text", () => {
    const row = buildAnswerLogRow({ recommendation: ["a", "b"], nextSteps: ["x".repeat(500)] })
    assert.equal(row?.recommendation, "a\nb")
    assert.equal(row?.next_steps[0]?.length, ANSWER_LOG_LIMITS.nextStep)
    const long = buildAnswerLogRow({ recommendation: "y".repeat(5000) })
    assert.equal(long?.recommendation.length, ANSWER_LOG_LIMITS.recommendation)
  })

  it("caps next steps and drops empty ones", () => {
    const row = buildAnswerLogRow({ recommendation: "ok", nextSteps: ["", "  ", ...Array.from({ length: 20 }, (_, i) => `s${i}`)] })
    assert.equal(row?.next_steps.length, ANSWER_LOG_LIMITS.nextSteps)
    assert.equal(row?.next_steps[0], "s0")
  })

  it("normalizes confidence to 0–1 and rejects junk", () => {
    assert.equal(buildAnswerLogRow({ recommendation: "ok", confidence: 0.42 })?.confidence, 0.42)
    assert.equal(buildAnswerLogRow({ recommendation: "ok", confidence: 85 })?.confidence, 0.85)
    assert.equal(buildAnswerLogRow({ recommendation: "ok", confidence: -1 })?.confidence, null)
    assert.equal(buildAnswerLogRow({ recommendation: "ok", confidence: 500 })?.confidence, null)
  })

  it("rejects out-of-range Normie ids and empty answers", () => {
    assert.equal(buildAnswerLogRow({ recommendation: "ok" }, 10000)?.normie_id, null)
    assert.equal(buildAnswerLogRow({ recommendation: "ok" }, null)?.normie_id, null)
    assert.equal(buildAnswerLogRow({ recommendation: "   " }), null)
  })
})

describe("answerLogEnabled", () => {
  it("is off by default and needs both the switch and the server key", () => {
    assert.equal(answerLogEnabled({}), false)
    assert.equal(answerLogEnabled({ ZULO_ANSWER_LOG: "on" }), false)
    assert.equal(answerLogEnabled({ SUPABASE_SERVICE_ROLE_KEY: "k" }), false)
    assert.equal(answerLogEnabled({ ZULO_ANSWER_LOG: "on", SUPABASE_SERVICE_ROLE_KEY: "k" }), true)
    assert.equal(answerLogEnabled({ ZULO_ANSWER_LOG: "off", SUPABASE_SERVICE_ROLE_KEY: "k" }), false)
  })
})

describe("zulo_answer_log migration", () => {
  const sql = fs.readFileSync("supabase/sql/2026-10-18-zulo-answer-log.sql", "utf8")
  it("is server-only: RLS forced, public roles revoked, no policies", () => {
    assert.match(sql, /force row level security/)
    assert.match(sql, /revoke all on table public\.zulo_answer_log from anon, authenticated/)
    assert.doesNotMatch(sql.split("-- Verification")[0]!, /create policy/i)
  })
  it("has no column for the question, wallet, ENS or IP", () => {
    const table = sql.slice(sql.indexOf("create table"), sql.indexOf("create index"))
    const columns = table.split("\n").map((l) => l.trim()).filter((l) => /^[a-z_]+\s+[a-z]/.test(l)).map((l) => l.split(/\s+/)[0])
    assert.ok(columns.includes("recommendation"))
    for (const banned of ["user_query", "question", "wallet", "user_wallet", "ens", "user_ens", "ip", "ip_address"]) {
      assert.ok(!columns.includes(banned), banned)
    }
  })
})
