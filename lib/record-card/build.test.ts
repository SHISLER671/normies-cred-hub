import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { loadArenaSector, type ArenaSource } from "./arena"
import { buildRecordCard, GATE_CLEAN_OWNERSHIP, GATE_REGISTERED, pulseGate, type RecordCardInputs } from "./build"

const NOW = "2026-10-18T10:00:00.000Z"

async function inputs(over: Partial<RecordCardInputs> = {}): Promise<RecordCardInputs> {
  return {
    tokenId: 7141,
    now: NOW,
    // Real shapes from api.normies.art, read 2026-10-18.
    binding: { agentId: "32626", timestamp: "1778887079", blockNumber: "25103790" },
    identity: { name: "Zulo", type: "Human" },
    canvas: { actionPoints: 12, level: 2, customized: false, delegate: "0xb8792e6516b88e73ed0723f8c1c8a92531a98767", gridSize: 40, baseCleared: false, lockedPixels: 0, freePixels: 12 },
    owner: { owner: "0xfafd8fb6b4e43ace0e365553f1b9242384591031" },
    zombie: { info: { isZombie: false } },
    pulse: { pulse_level: 4, max_level: 5, status: "Strong", breakdown: [GATE_REGISTERED, "Has active agent card", "Canvas activity detected", GATE_CLEAN_OWNERSHIP] },
    chatRatings: null,
    arena: await loadArenaSector(7141, NOW, { status: "COMING_SOON" }),
    ...over,
  }
}

describe("pulseGate (trust checks, never a level)", () => {
  it("passes only with both trust checks", () => {
    assert.equal(pulseGate([GATE_REGISTERED, GATE_CLEAN_OWNERSHIP]).passed, true)
    assert.equal(pulseGate([GATE_REGISTERED]).passed, false)
    assert.equal(pulseGate([GATE_CLEAN_OWNERSHIP]).passed, false)
    assert.equal(pulseGate(null).passed, false)
  })
  it("a level-3 agent with both trust checks passes; a level-3 agent missing one does not", () => {
    const honestUnpainted = [GATE_REGISTERED, "Has active agent card", GATE_CLEAN_OWNERSHIP]
    const busyButMessy = [GATE_REGISTERED, "Has active agent card", "Canvas activity detected"]
    assert.equal(pulseGate(honestUnpainted).passed, true)
    assert.equal(pulseGate(busyButMessy).passed, false)
    assert.match(pulseGate(busyButMessy).text, /clean ownership/)
  })
})

describe("buildRecordCard", () => {
  it("builds Zulo's card from real API shapes, every live field verified with its source", async () => {
    const c = buildRecordCard(await inputs())
    assert.equal(c.card_status, "arena_not_live")
    assert.equal(c.identity.agent_id.value, 32626)
    assert.equal(c.identity.agent_id.label, "verified")
    assert.equal(c.identity.agent_id.source_block, 25103790)
    assert.equal(c.identity.awakened_at.value, "2026-05-15T23:17:59.000Z")
    assert.equal(c.identity.agent_name.value, "Zulo")
    assert.equal(c.identity.pixels_attached.value, 12)
    assert.equal(c.context.canvas_delegate.value, "0xb8792e6516b88e73ed0723f8c1c8a92531a98767")
    assert.equal(c.pulse.gate.passed, true)
    assert.equal(c.identity.level.source.ref, "GET /normie/7141/canvas/info")
  })

  it("Arena fields are pending, never zero, while Arena is not live", async () => {
    const c = buildRecordCard(await inputs())
    for (const f of Object.values(c.sectors.arena.record)) {
      assert.equal(f.value, null)
      assert.equal(f.label, "pending")
      assert.equal(f.pending_reason, "Arena not live")
    }
    assert.equal(c.sectors.arena.rank.ranked, false)
  })

  it("a failed read shows unavailable, not a made-up value", async () => {
    const c = buildRecordCard(await inputs({ canvas: null, owner: null, pulse: null }))
    assert.equal(c.identity.level.label, "unavailable")
    assert.equal(c.identity.level.value, null)
    assert.equal(c.context.owner.label, "unavailable")
    assert.equal(c.context.canvas_delegate.label, "unavailable")
    assert.equal(c.pulse.available, false)
    assert.equal(c.pulse.gate.passed, false)
  })

  it("a zero-address delegate is shown as none (verified), not as an address", async () => {
    const base = await inputs()
    const c = buildRecordCard({ ...base, canvas: { ...base.canvas!, delegate: "0x0000000000000000000000000000000000000000" } })
    assert.equal(c.context.canvas_delegate.value, null)
    assert.equal(c.context.canvas_delegate.label, "verified")
  })

  it("an un-awakened Normie gets no record card status", async () => {
    const c = buildRecordCard(await inputs({ binding: null }))
    assert.equal(c.card_status, "not_awakened")
    assert.equal(c.identity.agent_id.value, null)
  })

  it("chat rating rides along with zero weight", async () => {
    const chat = {
      agent_id: 32626, label: "Chat rating", source: { tag1: "starred", tag2: "hive-chat", registry: "0x" }, available: true,
      recency_available: true, note: "", ranked: false, score: null, stars: null,
      raw: { ratings: 2, unique_raters: 2, average: 90 }, min_unique_raters: 5,
      weighting: { holders: 1, delegated_holders: 0, fresh_wallets: 0, repeat_raters: 0, excluded_self: 0 },
    }
    const c = buildRecordCard(await inputs({ chatRatings: chat }))
    assert.equal(c.chat_rating?.counts_toward_rank, false)
    assert.equal(c.chat_rating?.counts_toward_pulse, false)
    assert.equal(c.chat_rating?.raw.ratings, 2)
  })
})

describe("Arena plug-in", () => {
  it("never calls a source while Arena is not live", async () => {
    let called = false
    const src: ArenaSource = { ref: "test", kind: "official_api", load: async () => { called = true; return null } }
    const s = await loadArenaSector(1, NOW, { status: "COMING_SOON", sources: [src] })
    assert.equal(called, false)
    assert.equal(s.status, "not_live")
  })

  it("live Arena with no wired source stays pending", async () => {
    const s = await loadArenaSector(1, NOW, { status: "LIVE", sources: [] })
    assert.equal(s.status, "source_pending")
    assert.equal(s.record.wins.label, "pending")
  })

  it("live Arena with a source fills verified counts, still unranked", async () => {
    const src: ArenaSource = {
      ref: "GET /arena/normie/{id}",
      kind: "official_api",
      load: async () => ({ matches: 4, wins: 3, losses: 1, pixels_net: 20, last_match_at: "2026-11-20T00:00:00Z" }),
    }
    const s = await loadArenaSector(1, NOW, { status: "LIVE", sources: [src] })
    assert.equal(s.status, "unranked")
    assert.equal(s.record.wins.value, 3)
    assert.equal(s.record.wins.label, "verified")
    assert.equal(s.rank.ranked, false)
  })

  it("a failing source shows unavailable, never numbers", async () => {
    const src: ArenaSource = { ref: "x", kind: "onchain", load: async () => { throw new Error("rpc") } }
    const s = await loadArenaSector(1, NOW, { status: "LIVE", sources: [src] })
    assert.equal(s.status, "source_pending")
    assert.equal(s.record.matches.value, null)
  })
})
