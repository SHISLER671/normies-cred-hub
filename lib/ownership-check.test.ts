// Pulse level 4, "Clean ownership & delegation" (docs/zulo/pulse-trust-fixes-spec.md, PR-1): four checks, fail-closed.
import assert from "node:assert/strict"
import { describe, it } from "node:test"

import type { DelegateXyzResult } from "@/lib/delegations"

import {
  OWNER_TENURE_DAYS,
  OWNERSHIP_REASONS,
  OWNERSHIP_REASON_TEXT,
  evaluateOwnershipCheck,
  ownershipCheckLines,
  ownershipCheckUnreadable,
  shortAddress,
  type OwnershipInputs,
} from "./ownership-check"
import { loadOwnershipCheck, type OwnershipDeps } from "./ownership-check-load"

const OWNER = "0xfafd8fb6b4e43ace0e365553f1b9242384591031"
const PREVIOUS = "0x" + "b".repeat(40)
const DELEGATE = "0xb8792e6516b88e73ed0723f8c1c8a92531a98767"
const ZERO = "0x" + "0".repeat(40)
const NOW = new Date("2026-11-14T00:00:00.000Z")
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString()

const DX_CLEAN: DelegateXyzResult = { entries: [], failedVaults: [], checked: { v1: true, v2: true } }

/** Everything readable and clean: held 40 days, no canvas delegate, delegate.xyz read completed. */
const inputs = (over: Partial<OwnershipInputs> = {}): OwnershipInputs => ({
  now: NOW,
  chainOwner: { ok: true, value: OWNER },
  apiOwner: { ok: true, value: OWNER },
  index: { ok: true, value: { owner: OWNER, owner_since: daysAgo(40) } },
  canvas: { ok: true, value: { delegate: ZERO, delegateSetBy: ZERO } },
  delegateXyz: DX_CLEAN,
  ...over,
})

describe("evaluateOwnershipCheck: the pass case", () => {
  it("passes when all four checks pass, in the spec's response shape", () => {
    const c = evaluateOwnershipCheck(inputs())
    assert.deepEqual(c, {
      passed: true,
      reasons: [],
      owner_since: daysAgo(40),
      tenure_days_required: 30,
      canvas_delegate_set_by_owner: true,
      delegate_xyz: { checked: true, delegations_found: 0 },
      as_of: NOW.toISOString(),
    })
    assert.equal(OWNER_TENURE_DAYS, 30)
  })
  it("owner addresses are compared without regard to letter case", () => {
    const upper = "0x" + OWNER.slice(2).toUpperCase()
    const c = evaluateOwnershipCheck(inputs({ chainOwner: { ok: true, value: upper }, canvas: { ok: true, value: { delegate: DELEGATE, delegateSetBy: upper } } }))
    assert.equal(c.passed, true)
    assert.deepEqual(c.reasons, [])
  })
  it("exactly 30 days passes; one second less does not", () => {
    assert.equal(evaluateOwnershipCheck(inputs({ index: { ok: true, value: { owner: OWNER, owner_since: daysAgo(30) } } })).passed, true)
    const justUnder = new Date(NOW.getTime() - 30 * 86_400_000 + 1000).toISOString()
    const c = evaluateOwnershipCheck(inputs({ index: { ok: true, value: { owner: OWNER, owner_since: justUnder } } }))
    assert.deepEqual(c.reasons, ["tenure_short"])
    assert.equal(c.passed, false)
  })
  it("a delegate the current owner set is clean", () => {
    const c = evaluateOwnershipCheck(inputs({ canvas: { ok: true, value: { delegate: DELEGATE, delegateSetBy: OWNER } } }))
    assert.equal(c.passed, true)
    assert.equal(c.canvas_delegate_set_by_owner, true)
  })
  it("having delegate.xyz delegations does not fail the check; they are recorded", () => {
    const dx: DelegateXyzResult = {
      entries: [
        { tokenId: 12, vault: PREVIOUS, registry: "v2", verified: true },
        { tokenId: 99, vault: PREVIOUS, registry: "v2", verified: true },
      ],
      failedVaults: [],
      checked: { v1: true, v2: true },
    }
    const c = evaluateOwnershipCheck(inputs({ delegateXyz: dx }))
    assert.equal(c.passed, true)
    assert.deepEqual(c.delegate_xyz, { checked: true, delegations_found: 2 })
  })
})

describe("evaluateOwnershipCheck: each reason on its own", () => {
  const only = (over: Partial<OwnershipInputs>, reason: string) => {
    const c = evaluateOwnershipCheck(inputs(over))
    assert.deepEqual(c.reasons, [reason])
    return c
  }

  it("owner_mismatch: the API and the chain are both readable but disagree", () => {
    const c = only({ apiOwner: { ok: true, value: PREVIOUS } }, "owner_mismatch")
    assert.equal(c.passed, false)
  })
  it("owner_unreadable: the on-chain read failed", () => {
    const c = only({ chainOwner: { ok: false }, delegateXyz: null }, "owner_unreadable")
    assert.equal(c.passed, false)
    // Nothing downstream is claimed about an owner that couldn't be read.
    assert.equal(c.owner_since, null)
    assert.deepEqual(c.delegate_xyz, { checked: false, delegations_found: null })
  })
  it("owner_unreadable: the API owner is missing, malformed or the zero address", () => {
    for (const bad of [null, undefined, "", "0x1234", ZERO]) {
      assert.deepEqual(evaluateOwnershipCheck(inputs({ apiOwner: { ok: true, value: bad } })).reasons, ["owner_unreadable"], String(bad))
    }
    assert.deepEqual(evaluateOwnershipCheck(inputs({ apiOwner: { ok: false } })).reasons, ["owner_unreadable"])
  })
  it("owner_unreadable: the chain answers the zero address", () => {
    assert.deepEqual(evaluateOwnershipCheck(inputs({ chainOwner: { ok: true, value: ZERO }, delegateXyz: null })).reasons, ["owner_unreadable"])
  })
  it("tenure_short: held for less than 30 days", () => {
    const c = only({ index: { ok: true, value: { owner: OWNER, owner_since: daysAgo(12) } } }, "tenure_short")
    assert.equal(c.passed, false)
    assert.equal(c.owner_since, daysAgo(12))
  })
  it("tenure_unknown: the owner index could not be read (Supabase down)", () => {
    const c = only({ index: { ok: false } }, "tenure_unknown")
    assert.equal(c.passed, false)
    assert.equal(c.owner_since, null)
  })
  it("tenure_unknown: no row, or owner_since empty or not a date; never treated as long-held", () => {
    for (const value of [null, { owner: OWNER, owner_since: null }, { owner: OWNER, owner_since: "not a date" }]) {
      const c = evaluateOwnershipCheck(inputs({ index: { ok: true, value } }))
      assert.deepEqual(c.reasons, ["tenure_unknown"])
      assert.equal(c.passed, false)
    }
  })
  it("canvas_delegate_stale: reported, but level 4 is still granted when the other checks pass", () => {
    const c = only({ canvas: { ok: true, value: { delegate: DELEGATE, delegateSetBy: PREVIOUS } } }, "canvas_delegate_stale")
    assert.equal(c.passed, true)
    assert.equal(c.canvas_delegate_set_by_owner, false)
    assert.equal(ownershipCheckUnreadable(c), false)
  })
  it("canvas_unreadable: the canvas read failed", () => {
    const c = only({ canvas: { ok: false } }, "canvas_unreadable")
    assert.equal(c.passed, false)
    assert.equal(c.canvas_delegate_set_by_owner, null)
  })
  it("canvas_unreadable: a delegate is set but who set it can't be told", () => {
    for (const value of [null, { delegate: DELEGATE }, { delegate: DELEGATE, delegateSetBy: ZERO }, { delegate: "0xnope", delegateSetBy: OWNER }]) {
      assert.deepEqual(evaluateOwnershipCheck(inputs({ canvas: { ok: true, value } })).reasons, ["canvas_unreadable"])
    }
  })
  it("delegations_unreadable: a registry or a vault could not be read, or the read threw", () => {
    const failed: DelegateXyzResult[] = [
      { entries: [], failedVaults: [], checked: { v1: false, v2: true } },
      { entries: [], failedVaults: [], checked: { v1: true, v2: false } },
      { entries: [{ tokenId: 5, vault: PREVIOUS, registry: "v1", verified: false }], failedVaults: [PREVIOUS], checked: { v1: true, v2: true } },
    ]
    for (const dx of failed) {
      const c = evaluateOwnershipCheck(inputs({ delegateXyz: dx }))
      assert.deepEqual(c.reasons, ["delegations_unreadable"])
      assert.equal(c.passed, false)
      assert.deepEqual(c.delegate_xyz, { checked: false, delegations_found: null })
    }
    assert.deepEqual(evaluateOwnershipCheck(inputs({ delegateXyz: null })).reasons, ["delegations_unreadable"])
  })
})

describe("evaluateOwnershipCheck: just transferred", () => {
  it("live owner differs from the indexed owner: tenure_short even though owner_since looks old", () => {
    const c = evaluateOwnershipCheck(inputs({ index: { ok: true, value: { owner: PREVIOUS, owner_since: daysAgo(400) } } }))
    assert.deepEqual(c.reasons, ["tenure_short"])
    assert.equal(c.passed, false)
    // The old date belongs to the previous owner, so it is not shown as this owner's.
    assert.equal(c.owner_since, null)
  })
  it("an index row with no owner counts as just transferred, not as long-held", () => {
    const c = evaluateOwnershipCheck(inputs({ index: { ok: true, value: { owner: null, owner_since: daysAgo(400) } } }))
    assert.deepEqual(c.reasons, ["tenure_short"])
  })
  it("when the API and the chain disagree, tenure follows the chain owner", () => {
    const c = evaluateOwnershipCheck(inputs({ apiOwner: { ok: true, value: PREVIOUS }, index: { ok: true, value: { owner: PREVIOUS, owner_since: daysAgo(400) } } }))
    assert.deepEqual(c.reasons, ["owner_mismatch", "tenure_short"])
  })
})

describe("evaluateOwnershipCheck: several things wrong at once", () => {
  it("lists every reason in a fixed order, and a stale delegate never rescues a failed check", () => {
    const c = evaluateOwnershipCheck(
      inputs({
        index: { ok: false },
        canvas: { ok: true, value: { delegate: DELEGATE, delegateSetBy: PREVIOUS } },
        delegateXyz: { entries: [], failedVaults: [], checked: { v1: false, v2: false } },
      }),
    )
    assert.deepEqual(c.reasons, ["tenure_unknown", "canvas_delegate_stale", "delegations_unreadable"])
    assert.equal(c.passed, false)
    assert.equal(ownershipCheckUnreadable(c), true)
  })
  it("only the four couldn't-read reasons mark a result as unreadable", () => {
    const unreadable = OWNERSHIP_REASONS.filter((r) => ownershipCheckUnreadable({ reasons: [r] }))
    assert.deepEqual(unreadable, ["owner_unreadable", "tenure_unknown", "canvas_unreadable", "delegations_unreadable"])
  })
})

describe("plain-word copy", () => {
  it("every reason has plain words, and none prints a full address", () => {
    for (const r of OWNERSHIP_REASONS) {
      assert.ok(OWNERSHIP_REASON_TEXT[r].length > 0, r)
      assert.doesNotMatch(OWNERSHIP_REASON_TEXT[r], /0x[a-fA-F0-9]{40}/)
      assert.doesNotMatch(OWNERSHIP_REASON_TEXT[r], /_/)
    }
    assert.equal(OWNERSHIP_REASON_TEXT.canvas_delegate_stale, "Delegate from a previous owner, not honored")
  })
  it("shortens addresses as 0x1234…abcd", () => {
    assert.equal(shortAddress(OWNER), "0xfafd…1031")
    assert.equal(shortAddress("nope"), "unknown address")
  })
  it("a stale delegate is shown with a shortened address, next to the pass line", () => {
    const c = evaluateOwnershipCheck(inputs({ canvas: { ok: true, value: { delegate: DELEGATE, delegateSetBy: PREVIOUS } } }))
    const lines = ownershipCheckLines(c, { delegateSetBy: PREVIOUS })
    assert.deepEqual(lines, [
      "Owner confirmed on-chain and held for at least 30 days",
      "Delegate from a previous owner, not honored (set by 0xbbbb…bbbb)",
    ])
    assert.deepEqual(ownershipCheckLines(c), ["Owner confirmed on-chain and held for at least 30 days", "Delegate from a previous owner, not honored"])
    for (const l of lines) assert.doesNotMatch(l, /0x[a-fA-F0-9]{40}/)
  })
  it("a failed check has no pass line", () => {
    const c = evaluateOwnershipCheck(inputs({ index: { ok: false } }))
    assert.deepEqual(ownershipCheckLines(c), ["Couldn't read how long the owner has held it"])
  })
})

describe("loadOwnershipCheck: the reads, fail-closed", () => {
  const api = { apiOwner: { ok: true as const, value: OWNER }, canvas: { ok: true as const, value: { delegate: ZERO, delegateSetBy: ZERO } } }
  const deps = (over: Partial<OwnershipDeps> = {}): OwnershipDeps => ({
    readChainOwner: async () => OWNER,
    readIndexRow: async () => ({ owner: OWNER, owner_since: daysAgo(40) }),
    readDelegateXyz: async () => DX_CLEAN,
    now: () => NOW,
    ...over,
  })

  it("passes when every read answers", async () => {
    const c = await loadOwnershipCheck(7141, api, deps())
    assert.equal(c.passed, true)
    assert.deepEqual(c.reasons, [])
  })
  it("reads delegate.xyz for the live on-chain owner", async () => {
    let asked = ""
    await loadOwnershipCheck(7141, { ...api, apiOwner: { ok: true, value: PREVIOUS } }, deps({ readDelegateXyz: async (o) => { asked = o; return DX_CLEAN } }))
    assert.equal(asked, OWNER)
  })
  it("a thrown ownerOf is owner_unreadable, and delegate.xyz is not asked about nobody", async () => {
    let asked = false
    const c = await loadOwnershipCheck(7141, api, deps({
      readChainOwner: async () => { throw new Error("rpc down") },
      readDelegateXyz: async () => { asked = true; return DX_CLEAN },
    }))
    assert.deepEqual(c.reasons, ["owner_unreadable"])
    assert.equal(c.passed, false)
    assert.equal(asked, false)
  })
  it("Supabase down is tenure_unknown, never a pass", async () => {
    const c = await loadOwnershipCheck(7141, api, deps({ readIndexRow: async () => { throw new Error("db down") } }))
    assert.deepEqual(c.reasons, ["tenure_unknown"])
    assert.equal(c.passed, false)
  })
  it("a delegate.xyz read that throws is delegations_unreadable", async () => {
    const c = await loadOwnershipCheck(7141, api, deps({ readDelegateXyz: async () => { throw new Error("rpc down") } }))
    assert.deepEqual(c.reasons, ["delegations_unreadable"])
    assert.equal(c.passed, false)
  })
  it("a failed read is not remembered: the next call reads again", async () => {
    let calls = 0
    const flaky = deps({ readIndexRow: async () => { if (++calls === 1) throw new Error("db down"); return { owner: OWNER, owner_since: daysAgo(40) } } })
    assert.deepEqual((await loadOwnershipCheck(7141, api, flaky)).reasons, ["tenure_unknown"])
    assert.equal((await loadOwnershipCheck(7141, api, flaky)).passed, true)
  })
  it("canvas that the Pulse couldn't read is canvas_unreadable", async () => {
    const c = await loadOwnershipCheck(7141, { ...api, canvas: { ok: false } }, deps())
    assert.deepEqual(c.reasons, ["canvas_unreadable"])
  })
})
