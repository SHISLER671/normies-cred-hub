import assert from "node:assert/strict"
import fs from "node:fs"
import { describe, it } from "node:test"

import {
  ASK_DAILY_CAP,
  DAILY_CAP_MESSAGE_ALL,
  DAILY_CAP_MESSAGE_CALLER,
  DAY_SEC,
  checkDailyCap,
  dailyCapMessage,
  type DailyCap,
  type LimitCheck,
} from "./dailyCap"

/** A counting limiter with the same contract as checkRateLimitById: a turned-away call is not counted. */
function fakeLimiter() {
  const counts = new Map<string, number>()
  const calls: { id: string; bucket: string; limit: number; windowSec: number }[] = []
  const check: LimitCheck = async (id, bucket, limit, windowSec) => {
    calls.push({ id, bucket, limit, windowSec })
    const key = `${bucket}:${id}`
    const used = counts.get(key) ?? 0
    if (used >= limit) return { ok: false, retryAfter: 1234 }
    counts.set(key, used + 1)
    return { ok: true }
  }
  return { check, calls, used: (bucket: string, id: string) => counts.get(`${bucket}:${id}`) ?? 0 }
}

const CAP: DailyCap = { ip: 3, wallet: 2, all: 5 }
const W1 = "0x1111111111111111111111111111111111111111"

describe("daily cap: per caller", () => {
  it("lets a caller through up to the cap, then turns them away with the limiter's wait time", async () => {
    const l = fakeLimiter()
    for (let i = 0; i < CAP.ip; i++) {
      assert.deepEqual(await checkDailyCap(l.check, "zulo-ask", CAP, { ip: "1.1.1.1" }), { ok: true })
    }
    assert.deepEqual(await checkDailyCap(l.check, "zulo-ask", CAP, { ip: "1.1.1.1" }), {
      ok: false,
      scope: "ip",
      retryAfter: 1234,
    })
  })

  it("one caller at their cap does not block a different caller", async () => {
    const l = fakeLimiter()
    for (let i = 0; i < CAP.ip + 2; i++) await checkDailyCap(l.check, "zulo-ask", CAP, { ip: "1.1.1.1" })
    assert.deepEqual(await checkDailyCap(l.check, "zulo-ask", CAP, { ip: "2.2.2.2" }), { ok: true })
  })

  it("caps a wallet across addresses when a wallet is sent", async () => {
    const l = fakeLimiter()
    assert.equal((await checkDailyCap(l.check, "zulo-ask", CAP, { ip: "1.1.1.1", wallet: W1 })).ok, true)
    assert.equal((await checkDailyCap(l.check, "zulo-ask", CAP, { ip: "2.2.2.2", wallet: W1 })).ok, true)
    assert.deepEqual(await checkDailyCap(l.check, "zulo-ask", CAP, { ip: "3.3.3.3", wallet: W1 }), {
      ok: false,
      scope: "wallet",
      retryAfter: 1234,
    })
  })

  it("never checks a wallet bucket when no wallet is sent", async () => {
    const l = fakeLimiter()
    await checkDailyCap(l.check, "zulo-ask", CAP, { ip: "1.1.1.1" })
    assert.deepEqual(
      l.calls.map((c) => c.bucket),
      ["zulo-ask-day-ip", "zulo-ask-day-all"],
    )
  })
})

describe("daily cap: everyone combined", () => {
  it("turns everyone away once the combined cap is used, even brand-new callers", async () => {
    const l = fakeLimiter()
    for (let i = 0; i < CAP.all; i++) {
      assert.equal((await checkDailyCap(l.check, "zulo-ask", CAP, { ip: `10.0.0.${i}` })).ok, true)
    }
    assert.deepEqual(await checkDailyCap(l.check, "zulo-ask", CAP, { ip: "10.0.0.99" }), {
      ok: false,
      scope: "all",
      retryAfter: 1234,
    })
  })

  it("a caller over their own cap does not use up the combined allowance", async () => {
    const l = fakeLimiter()
    for (let i = 0; i < CAP.ip + 50; i++) await checkDailyCap(l.check, "zulo-ask", CAP, { ip: "1.1.1.1" })
    assert.equal(l.used("zulo-ask-day-all", "all"), CAP.ip)
    assert.equal((await checkDailyCap(l.check, "zulo-ask", CAP, { ip: "2.2.2.2" })).ok, true)
  })
})

describe("daily cap: buckets and window", () => {
  it("uses its own buckets, the configured limits and a 24-hour window", async () => {
    const l = fakeLimiter()
    await checkDailyCap(l.check, "zulo-ask", CAP, { ip: "1.1.1.1", wallet: W1 })
    assert.equal(DAY_SEC, 24 * 60 * 60)
    assert.deepEqual(l.calls, [
      { id: "1.1.1.1", bucket: "zulo-ask-day-ip", limit: CAP.ip, windowSec: DAY_SEC },
      { id: W1, bucket: "zulo-ask-day-wallet", limit: CAP.wallet, windowSec: DAY_SEC },
      { id: "all", bucket: "zulo-ask-day-all", limit: CAP.all, windowSec: DAY_SEC },
    ])
  })
})

describe("daily cap: Ask numbers and wording", () => {
  it("Ask's caps are whole, positive, and no single caller can use the whole day", () => {
    for (const n of [ASK_DAILY_CAP.ip, ASK_DAILY_CAP.wallet, ASK_DAILY_CAP.all]) {
      assert.ok(Number.isInteger(n) && n > 0, String(n))
    }
    assert.ok(ASK_DAILY_CAP.ip * 2 <= ASK_DAILY_CAP.all)
    assert.ok(ASK_DAILY_CAP.wallet * 2 <= ASK_DAILY_CAP.all)
  })

  it("the messages say Ask is free and never mention paying", () => {
    assert.equal(dailyCapMessage("ip"), DAILY_CAP_MESSAGE_CALLER)
    assert.equal(dailyCapMessage("wallet"), DAILY_CAP_MESSAGE_CALLER)
    assert.equal(dailyCapMessage("all"), DAILY_CAP_MESSAGE_ALL)
    for (const m of [DAILY_CAP_MESSAGE_CALLER, DAILY_CAP_MESSAGE_ALL]) {
      assert.match(m, /Ask is free/)
      assert.match(m, /24 hours/)
      assert.doesNotMatch(m, /\bpay|\bbuy|upgrade|subscri|top.?up|premium|credits?\b|\$|pixel|tip\b|donat|sponsor/i)
    }
  })

  it("the plan doc quotes the same numbers as the code", () => {
    const doc = fs.readFileSync("docs/zulo/sustainability-plan.md", "utf8")
    assert.ok(doc.includes(`${ASK_DAILY_CAP.ip} Ask calls in any 24 hours per address`), "per-address cap")
    assert.ok(doc.includes(`${ASK_DAILY_CAP.wallet} per wallet`), "per-wallet cap")
    assert.ok(doc.includes(`${ASK_DAILY_CAP.all} Ask calls in any 24 hours`), "combined cap")
  })
})

describe("daily cap: wiring", () => {
  const src = fs.readFileSync("lib/middleware/rateLimit.ts", "utf8")

  it("only the Ask profile carries a daily cap", () => {
    assert.match(src, /ask: \{ ip: 12, wallet: 12, windowSec: 60, daily: ASK_DAILY_CAP \}/)
    assert.equal(src.match(/daily: /g)?.length, 1)
  })

  it("the daily cap runs after the per-minute limits and answers 429 with its own code", () => {
    const perMinuteWallet = src.indexOf("`${prefix}-wallet`")
    const daily = src.indexOf("checkDailyCap(checkRateLimitById, prefix, cfg.daily")
    assert.ok(perMinuteWallet > 0 && daily > perMinuteWallet)
    assert.match(src, /error: dailyCapMessage\(day\.scope\), code: "daily_cap", retryable: false/)
    assert.match(src, /"Retry-After": String\(day\.retryAfter\)/)
  })

  it("Ask still goes through the ask profile", () => {
    assert.match(fs.readFileSync("app/api/zulo/ask/route.ts", "utf8"), /enforceDualRateLimit\(req, "ask"/)
  })
})
