/**
 * Pulse + Paths usage instrumentation — run with: pnpm test:instrumentation
 */

import assert from "node:assert/strict"
import { describe, it, before } from "node:test"

import {
  __expirePulseRecentForTests,
  __forceMemoryStoreForTests,
  __resetUsageMemoryForTests,
  USAGE_CONDITIONED_PATHS_THRESHOLD,
  USAGE_PULSE_CALLS_THRESHOLD,
  getTokenUsageSignal,
  getUsageMetrics,
  recordPathsCall,
  recordPulseCall,
} from "./pulse-paths"

before(() => {
  __forceMemoryStoreForTests()
})

describe("pulse → paths correlation", () => {
  it("marks Paths as pulseConditioned after a recent Pulse for the same tokenId", async () => {
    __resetUsageMemoryForTests()

    await recordPulseCall({
      tokenId: 7141,
      agentId: 32626,
      source: "get",
      pulseLevel: 4,
    })

    const conditioned = await recordPathsCall({
      tokenId: 7141,
      intentTag: "burn",
      intentRaw: "efficient burn fodder",
      pathCount: 5,
      pulseLevelAtTime: 4,
    })

    assert.equal(conditioned, true)

    const metrics = await getUsageMetrics()
    assert.equal(metrics.pulseCalls, 1)
    assert.equal(metrics.pathsCalls, 1)
    assert.equal(metrics.pulseConditionedPaths, 1)
    assert.equal(metrics.pulseConditionedRate, 1)
    assert.equal(metrics.uniqueTokenIds, 1)
    assert.equal(metrics.pulseCallsBySource.get, 1)
    assert.equal(metrics.pulseCallsBySource.tool, 0)
  })

  it("does not condition Paths when no recent Pulse exists", async () => {
    __resetUsageMemoryForTests()

    const conditioned = await recordPathsCall({
      tokenId: 42,
      intentTag: "market",
      pathCount: 3,
    })

    assert.equal(conditioned, false)
    const metrics = await getUsageMetrics()
    assert.equal(metrics.pathsCalls, 1)
    assert.equal(metrics.pulseConditionedPaths, 0)
    assert.equal(metrics.pulseConditionedRate, 0)
  })

  it("does not condition Paths for a different tokenId", async () => {
    __resetUsageMemoryForTests()

    await recordPulseCall({ tokenId: 7141, source: "tool" })
    const conditioned = await recordPathsCall({
      tokenId: 1,
      intentTag: "pulse",
      pathCount: 4,
    })

    assert.equal(conditioned, false)
    const metrics = await getUsageMetrics()
    assert.equal(metrics.pulseCallsBySource.tool, 1)
    assert.equal(metrics.pulseConditionedPaths, 0)
  })

  it("does not condition Paths when tokenId is missing", async () => {
    __resetUsageMemoryForTests()

    await recordPulseCall({ tokenId: 7141, source: "get" })
    const conditioned = await recordPathsCall({
      intentTag: "strategy",
      pathCount: 5,
    })

    assert.equal(conditioned, false)
  })

  it("treats an expired recent Pulse as not conditioned", async () => {
    __resetUsageMemoryForTests()

    await recordPulseCall({ tokenId: 7141, source: "get" })
    __expirePulseRecentForTests(7141)

    const conditioned = await recordPathsCall({
      tokenId: 7141,
      intentTag: "canvas",
      pathCount: 3,
    })

    assert.equal(conditioned, false)
  })
})

describe("metrics + fail-open", () => {
  it("counts unique tokenIds and source split", async () => {
    __resetUsageMemoryForTests()

    await recordPulseCall({ tokenId: 1, source: "get" })
    await recordPulseCall({ tokenId: 1, source: "get" })
    await recordPulseCall({ tokenId: 2, source: "tool" })

    const metrics = await getUsageMetrics()
    assert.equal(metrics.pulseCalls, 3)
    assert.equal(metrics.uniqueTokenIds, 2)
    assert.equal(metrics.pulseCallsBySource.get, 2)
    assert.equal(metrics.pulseCallsBySource.tool, 1)
    assert.equal(metrics.recentWindowSec, 900)
  })

  it("omits callerWallet from event dumps", async () => {
    __resetUsageMemoryForTests()

    await recordPulseCall({
      tokenId: 9,
      source: "get",
      callerWallet: "0xb8792e6516b88e73ed0723f8c1c8a92531a98767",
    })

    const metrics = await getUsageMetrics({ includeEvents: true })
    assert.ok(metrics.events && metrics.events.length >= 1)
    assert.equal(
      Object.prototype.hasOwnProperty.call(metrics.events[0], "callerWallet"),
      false,
    )
  })

  it("swallows invalid pulse tokenIds without throwing", async () => {
    __resetUsageMemoryForTests()

    await recordPulseCall({ tokenId: -1, source: "get" })
    await recordPulseCall({ tokenId: 10000, source: "tool" })

    const metrics = await getUsageMetrics()
    assert.equal(metrics.pulseCalls, 0)
  })
})

describe("level-5 usage signal", () => {
  it("does not earn with sparse Pulse calls", async () => {
    __resetUsageMemoryForTests()
    await recordPulseCall({ tokenId: 200, source: "get" })
    const s = await getTokenUsageSignal(200)
    assert.equal(s.earned, false)
    assert.equal(s.pulseCalls, 1)
  })

  it("earns after enough Pulse calls in the lookback window", async () => {
    __resetUsageMemoryForTests()
    for (let i = 0; i < USAGE_PULSE_CALLS_THRESHOLD; i++) {
      await recordPulseCall({ tokenId: 201, source: "get" })
    }
    const s = await getTokenUsageSignal(201)
    assert.equal(s.pulseCalls, USAGE_PULSE_CALLS_THRESHOLD)
    assert.equal(s.earned, true)
  })

  it("earns from Pulse-conditioned Paths activity", async () => {
    __resetUsageMemoryForTests()
    await recordPulseCall({ tokenId: 202, source: "get" })
    for (let i = 0; i < USAGE_CONDITIONED_PATHS_THRESHOLD; i++) {
      await recordPathsCall({
        tokenId: 202,
        intentTag: "burn",
        pathCount: 3,
      })
    }
    const s = await getTokenUsageSignal(202)
    assert.ok(s.conditionedPaths >= USAGE_CONDITIONED_PATHS_THRESHOLD)
    assert.equal(s.earned, true)
  })
})
