import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  MAX_LEVEL,
  NEXT_SIGNAL_LUMINOUS,
  TRUST_SIGNALS,
  USAGE_BREAKDOWN_SIGNAL,
  assemblePulseSignals,
} from "./agent-pulse"

const FOUR = [...TRUST_SIGNALS]

describe("assemblePulseSignals: levels 1–4 are trust, Luminous is popularity on top", () => {
  it("four trust checks without popularity is 4 (Strong) and points to Luminous", () => {
    const p = assemblePulseSignals(FOUR, false)
    assert.equal(p.pulse_level, 4)
    assert.equal(p.status, "Strong")
    assert.equal(p.next_signal, NEXT_SIGNAL_LUMINOUS)
    assert.equal(p.breakdown.includes(USAGE_BREAKDOWN_SIGNAL), false)
  })

  it("four trust checks plus popularity reaches Luminous", () => {
    const p = assemblePulseSignals(FOUR, true)
    assert.equal(MAX_LEVEL, 5)
    assert.equal(p.pulse_level, 5)
    assert.equal(p.status, "Luminous")
    assert.equal(p.next_signal, null)
    assert.ok(p.breakdown.includes(USAGE_BREAKDOWN_SIGNAL))
    assert.match(p.note, /popularity/i)
  })

  it("popularity never stands in for a missing trust check", () => {
    const p = assemblePulseSignals(FOUR.slice(0, 3), true)
    assert.equal(p.pulse_level, 3)
    assert.equal(p.status, "Solid")
    assert.equal(p.breakdown.includes(USAGE_BREAKDOWN_SIGNAL), false)
    assert.equal(p.next_signal, "Still missing: Clean ownership & delegation.")
  })

  it("a usage string passed in is ignored; only the popularity flag counts", () => {
    const p = assemblePulseSignals([...FOUR, USAGE_BREAKDOWN_SIGNAL], false)
    assert.equal(p.pulse_level, 4)
  })

  it("names the missing checks in test order and ignores unknown signals", () => {
    const p = assemblePulseSignals(["Clean ownership & delegation", "Something new", "ERC-8004 registered"], false)
    assert.equal(p.pulse_level, 2)
    assert.equal(p.status, "Building")
    assert.deepEqual(p.breakdown, ["ERC-8004 registered", "Clean ownership & delegation"])
    assert.equal(p.next_signal, "Still missing: Has active agent card, Canvas activity detected.")
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
