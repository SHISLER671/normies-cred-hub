import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  MAX_LEVEL,
  NOTE,
  POPULARITY_NOTE,
  PULSE_SCALE,
  TRENDING_LABEL,
  TRUST_SIGNALS,
  assemblePulseSignals,
} from "./agent-pulse"
import { PULSE_MAX_LEVEL, TRENDING_LABEL as BADGE_LABEL } from "../pulse/beats"

const FOUR = [...TRUST_SIGNALS]
/** The string the old fifth level used to add to the breakdown. It must never count again. */
const OLD_USAGE_SIGNAL = "Recent agent usage / interaction signal"

describe("assemblePulseSignals: levels 1–4 are the four trust checks and nothing else", () => {
  it("four trust checks is 4 (Strong), the top level, with nothing left to do", () => {
    const p = assemblePulseSignals(FOUR)
    assert.equal(MAX_LEVEL, 4)
    assert.equal(p.pulse_level, 4)
    assert.equal(p.pulse_level, MAX_LEVEL)
    assert.equal(p.status, "Strong")
    assert.equal(p.next_signal, null)
    assert.deepEqual(p.breakdown, FOUR)
  })

  it("the level is exactly the number of trust checks passed, 0 to 4", () => {
    const statuses = ["Dormant", "Emerging", "Building", "Solid", "Strong"]
    for (let n = 0; n <= 4; n++) {
      const p = assemblePulseSignals(FOUR.slice(0, n))
      assert.equal(p.pulse_level, n)
      assert.equal(p.status, statuses[n])
      assert.equal(p.breakdown.length, n)
    }
  })

  it("a missing trust check is named, and nothing stands in for it", () => {
    const p = assemblePulseSignals(FOUR.slice(0, 3))
    assert.equal(p.pulse_level, 3)
    assert.equal(p.status, "Solid")
    assert.equal(p.next_signal, "Still missing: Clean ownership & delegation.")
  })

  it("the old usage string passed in is ignored: it adds no level and never appears in the breakdown", () => {
    const four = assemblePulseSignals([...FOUR, OLD_USAGE_SIGNAL])
    assert.equal(four.pulse_level, 4)
    assert.equal(four.breakdown.includes(OLD_USAGE_SIGNAL), false)
    const three = assemblePulseSignals([...FOUR.slice(0, 3), OLD_USAGE_SIGNAL])
    assert.equal(three.pulse_level, 3)
    assert.equal(three.breakdown.includes(OLD_USAGE_SIGNAL), false)
  })

  it("names the missing checks in test order and ignores unknown signals", () => {
    const p = assemblePulseSignals(["Clean ownership & delegation", "Something new", "ERC-8004 registered"])
    assert.equal(p.pulse_level, 2)
    assert.equal(p.status, "Building")
    assert.deepEqual(p.breakdown, ["ERC-8004 registered", "Clean ownership & delegation"])
    assert.equal(p.next_signal, "Still missing: Has active agent card, Canvas activity detected.")
  })

  it("the copy says popularity is separate, in plain words, and no longer names a fifth level", () => {
    assert.equal(PULSE_SCALE, "trust-0-4")
    assert.equal(TRENDING_LABEL, "Trending on NCH")
    assert.equal(BADGE_LABEL, TRENDING_LABEL)
    assert.equal(PULSE_MAX_LEVEL, MAX_LEVEL)
    for (const text of [NOTE, POPULARITY_NOTE]) {
      assert.match(text, /Trending on NCH/)
      assert.match(text, /never changes the (Pulse )?level/)
      assert.doesNotMatch(text, /level 5|Level 5|Lumin/i)
    }
  })
})

describe("parseTokenId (strict)", () => {
  it("accepts whole numbers 0–9999, as numbers or digit strings", async () => {
    const { parseTokenId } = await import("./agent-pulse")
    assert.equal(parseTokenId(7141), 7141)
    assert.equal(parseTokenId("7141"), 7141)
    assert.equal(parseTokenId("0"), 0)
    assert.equal(parseTokenId("07141"), 7141)
    assert.equal(parseTokenId(" 42 "), 42)
  })
  it("refuses junk that parseInt used to let through", async () => {
    const { parseTokenId } = await import("./agent-pulse")
    for (const bad of ["7141abc", "1e3", "12.9", 1.5, "", "-1", -1, 10000, "10000", true, null, undefined, "0x1f", NaN]) {
      assert.equal(parseTokenId(bad), null, String(bad))
    }
  })
})

describe("getAgentPulse: level 4 comes from the ownership check, fail-closed", () => {
  const OWNER = "0xfafd8fb6b4e43ace0e365553f1b9242384591031"
  const PREVIOUS = "0x" + "b".repeat(40)
  const DELEGATE = "0xb8792e6516b88e73ed0723f8c1c8a92531a98767"
  const ZERO = "0x" + "0".repeat(40)
  const NOW = new Date("2026-11-14T00:00:00.000Z")
  const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString()
  const CLEAN = "Clean ownership & delegation"

  type Canvas = { delegate: string; delegateSetBy: string } | "down"
  /** Stub the official API (the only fetch this path makes in a test: the agent is not awakened, so no registry read). */
  type Usage = import("@/lib/instrumentation/pulse-paths").TokenUsageSignal
  const NO_USAGE: Usage = { pulseCalls: 0, conditionedPaths: 0, earned: false, lookbackDays: 14, readable: true }

  async function pulse(opts: { apiOwner?: string; canvas?: Canvas; deps?: Partial<import("@/lib/ownership-check-load").OwnershipDeps> } = {}) {
    const { getAgentPulse } = await import("./agent-pulse")
    const canvas = opts.canvas ?? { delegate: ZERO, delegateSetBy: ZERO }
    const realFetch = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input)
      const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
      if (url.endsWith("/normie/7141/owner")) return json({ tokenId: "7141", owner: opts.apiOwner ?? OWNER })
      if (url.endsWith("/normie/7141/canvas/info")) {
        return canvas === "down" ? json({ error: "boom" }, 503) : json({ actionPoints: 12, level: 2, customized: true, ...canvas })
      }
      if (url.includes("api.normies.art")) return json({ error: "not found" }, 404)
      throw new Error(`unexpected fetch in test: ${url}`)
    }) as typeof fetch
    try {
      const result = await getAgentPulse(7141, {
        readUsage: async () => NO_USAGE,
        ownershipDeps: {
          readChainOwner: async () => OWNER,
          readIndexRow: async () => ({ owner: OWNER, owner_since: daysAgo(40) }),
          readDelegateXyz: async () => ({ entries: [], failedVaults: [], checked: { v1: true, v2: true } }),
          now: () => NOW,
          ...opts.deps,
        },
      })
      assert.ok(result.ok)
      return result.data
    } finally {
      globalThis.fetch = realFetch
    }
  }

  it("all four checks pass: the check is in the breakdown and ownership_check says passed", async () => {
    const p = await pulse()
    assert.ok(p.breakdown.includes(CLEAN))
    assert.deepEqual(p.ownership_check, {
      passed: true,
      reasons: [],
      owner_since: daysAgo(40),
      tenure_days_required: 30,
      canvas_delegate_set_by_owner: true,
      delegate_xyz: { checked: true, delegations_found: 0 },
      as_of: NOW.toISOString(),
    })
  })
  it("the response only gains ownership_check: every earlier field is still there", async () => {
    const p = await pulse()
    for (const key of ["token_id", "agent_id", "pulse_level", "max_level", "status", "breakdown", "next_signal", "note", "popularity"]) {
      assert.ok(key in p, key)
    }
    assert.equal(p.max_level, MAX_LEVEL)
  })
  it("a well-formed owner and an empty delegate are no longer enough (the old rule): a 12-day owner is not granted", async () => {
    const p = await pulse({ deps: { readIndexRow: async () => ({ owner: OWNER, owner_since: daysAgo(12) }) } })
    assert.equal(p.breakdown.includes(CLEAN), false)
    assert.deepEqual(p.ownership_check?.reasons, ["tenure_short"])
    assert.match(p.next_signal ?? "", /Clean ownership & delegation/)
  })
  it("just transferred: live owner differs from the indexed owner, not granted even with an old owner_since", async () => {
    const p = await pulse({ deps: { readIndexRow: async () => ({ owner: PREVIOUS, owner_since: daysAgo(400) }) } })
    assert.equal(p.breakdown.includes(CLEAN), false)
    assert.deepEqual(p.ownership_check?.reasons, ["tenure_short"])
    assert.equal(p.ownership_check?.owner_since, null)
  })
  it("the owner API and the chain disagree: owner_mismatch, not granted", async () => {
    const p = await pulse({ apiOwner: PREVIOUS })
    assert.equal(p.breakdown.includes(CLEAN), false)
    assert.deepEqual(p.ownership_check?.reasons, ["owner_mismatch"])
  })
  it("a delegate left by a previous owner is reported but level 4 is still granted", async () => {
    const p = await pulse({ canvas: { delegate: DELEGATE, delegateSetBy: PREVIOUS } })
    assert.ok(p.breakdown.includes(CLEAN))
    assert.deepEqual(p.ownership_check?.reasons, ["canvas_delegate_stale"])
    assert.equal(p.ownership_check?.passed, true)
    assert.equal(p.ownership_check?.canvas_delegate_set_by_owner, false)
  })
  it("each couldn't-read is not granted and says why", async () => {
    const down = async () => { throw new Error("down") }
    const cases: Array<[Parameters<typeof pulse>[0], string]> = [
      [{ deps: { readChainOwner: down } }, "owner_unreadable"],
      [{ deps: { readIndexRow: down } }, "tenure_unknown"],
      [{ canvas: "down" }, "canvas_unreadable"],
      [{ deps: { readDelegateXyz: down } }, "delegations_unreadable"],
      [{ deps: { readDelegateXyz: async () => ({ entries: [], failedVaults: [], checked: { v1: true, v2: false } }) } }, "delegations_unreadable"],
    ]
    for (const [opts, reason] of cases) {
      const p = await pulse(opts)
      assert.equal(p.breakdown.includes(CLEAN), false, reason)
      assert.deepEqual(p.ownership_check?.reasons, [reason])
      assert.equal(p.ownership_check?.passed, false, reason)
    }
  })
  it("a couldn't-read is not cached: the next check reads again and can pass", async () => {
    const failed = await pulse({ deps: { readIndexRow: async () => { throw new Error("down") } } })
    assert.equal(failed.breakdown.includes(CLEAN), false)
    assert.ok((await pulse()).breakdown.includes(CLEAN))
  })
})

describe("getAgentPulse: popularity is a separate badge, never a level", () => {
  // Same stubbed reads as above, kept local so each describe stands alone.
  const OWNER = "0xfafd8fb6b4e43ace0e365553f1b9242384591031"
  const ZERO = "0x" + "0".repeat(40)
  const NOW = new Date("2026-11-14T00:00:00.000Z")
  type Usage = import("@/lib/instrumentation/pulse-paths").TokenUsageSignal
  const HIGH: Usage = { pulseCalls: 40, conditionedPaths: 9, earned: true, lookbackDays: 14, readable: true }
  const QUIET: Usage = { pulseCalls: 2, conditionedPaths: 0, earned: false, lookbackDays: 14, readable: true }
  const UNREADABLE: Usage = { pulseCalls: 0, conditionedPaths: 0, earned: false, lookbackDays: 14, readable: false }

  /**
   * `checks` trust checks pass: canvas activity and clean ownership always; the agent card from 3; ERC-8004 registration at 4
   * (the registry's ownerOf is answered by the stub, so no real chain read happens).
   */
  async function pulse(checks: 2 | 3 | 4, usage: Usage | "throws") {
    const { getAgentPulse } = await import("./agent-pulse")
    const realFetch = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
      if (url.endsWith("/normie/7141/owner")) return json({ tokenId: "7141", owner: OWNER })
      if (url.endsWith("/normie/7141/canvas/info")) return json({ actionPoints: 12, level: 2, customized: true, delegate: ZERO, delegateSetBy: ZERO })
      // An agent id that isn't a number never reaches the registry, but the card fields still count.
      if (checks === 3 && url.endsWith("/agents/info/7141")) return json({ agentId: "pending", name: "Zulo", tagline: "hi" })
      if (checks === 4 && url.endsWith("/agents/info/7141")) return json({ agentId: "32626", name: "Zulo", tagline: "hi" })
      // The Identity Registry read (JSON-RPC eth_call): answer with an owner address, which is enough to count as registered.
      if (checks === 4 && init?.method === "POST" && typeof init.body === "string" && init.body.includes("eth_call")) {
        return json({ jsonrpc: "2.0", id: JSON.parse(init.body).id, result: "0x" + OWNER.slice(2).padStart(64, "0") })
      }
      if (url.includes("api.normies.art")) return json({ error: "not found" }, 404)
      throw new Error(`unexpected fetch in test: ${url}`)
    }) as typeof fetch
    try {
      const result = await getAgentPulse(7141, {
        readUsage: async () => { if (usage === "throws") throw new Error("counters down"); return usage },
        ownershipDeps: {
          readChainOwner: async () => OWNER,
          readIndexRow: async () => ({ owner: OWNER, owner_since: new Date(NOW.getTime() - 40 * 86_400_000).toISOString() }),
          readDelegateXyz: async () => ({ entries: [], failedVaults: [], checked: { v1: true, v2: true } }),
          now: () => NOW,
        },
      })
      assert.ok(result.ok)
      return result.data
    } finally {
      globalThis.fetch = realFetch
    }
  }

  it("pulse_scale is \"trust-0-4\" and max_level is 4", async () => {
    const p = await pulse(2, QUIET)
    assert.equal(p.pulse_scale, "trust-0-4")
    assert.equal(p.max_level, 4)
  })

  it("a 3/4 agent with high usage stays 3, with trending: true", async () => {
    const quiet = await pulse(3, QUIET)
    const busy = await pulse(3, HIGH)
    assert.equal(quiet.pulse_level, 3)
    assert.equal(busy.pulse_level, 3)
    assert.equal(busy.status, "Solid")
    assert.deepEqual(busy.breakdown, quiet.breakdown)
    assert.equal(busy.next_signal, quiet.next_signal)
    assert.equal(quiet.trending, false)
    assert.equal(busy.trending, true)
  })

  it("trending is exactly popularity.popular, and the popularity object keeps its shape", async () => {
    const p = await pulse(2, HIGH)
    assert.deepEqual(p.popularity, { pulse_checkers: 40, paths_users: 9, lookback_days: 14, popular: true, note: POPULARITY_NOTE })
    assert.equal(p.trending, p.popularity?.popular)
    const q = await pulse(2, QUIET)
    assert.deepEqual(q.popularity, { pulse_checkers: 2, paths_users: 0, lookback_days: 14, popular: false, note: POPULARITY_NOTE })
    assert.equal(q.trending, false)
  })

  it("unreadable popularity counters give trending: false and don't change the level", async () => {
    const readable = await pulse(3, HIGH)
    for (const usage of [UNREADABLE, "throws"] as const) {
      const p = await pulse(3, usage)
      assert.equal(p.popularity, null)
      assert.equal(p.trending, false)
      assert.equal(p.pulse_level, readable.pulse_level)
      assert.deepEqual(p.breakdown, readable.breakdown)
    }
  })

  it("a 4/4 agent with high usage stays 4 (the top trust status), with trending: true", async () => {
    const quiet = await pulse(4, QUIET)
    const busy = await pulse(4, HIGH)
    for (const p of [quiet, busy]) {
      assert.equal(p.pulse_level, 4)
      assert.equal(p.max_level, 4)
      assert.equal(p.status, "Strong")
      assert.deepEqual(p.breakdown, [...TRUST_SIGNALS])
      assert.equal(p.next_signal, null)
    }
    assert.equal(quiet.trending, false)
    assert.equal(busy.trending, true)
  })

  it("the response only gains fields: every earlier field is still there", async () => {
    const p = await pulse(2, HIGH)
    for (const key of ["token_id", "agent_id", "pulse_level", "max_level", "status", "breakdown", "next_signal", "note", "popularity", "ownership_check", "trending", "pulse_scale"]) {
      assert.ok(key in p, key)
    }
  })
})
