import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

import { APPROVAL_TOPIC, latestPerPair, parseApprovalLogs, scanRanges } from "./pixel-approvals"
import { buildApprovalRows, isActiveApproval } from "./ap-check/core"

const STORAGE = "0x96F2DA32Bb9D429d59ac13dB469f4950cBe02084"
const pad = (a: string) => "0x" + "0".repeat(24) + a.slice(2).toLowerCase()
const OWNER = "0xab7dbf90b9924dffd235cfafef95f3f534b1ee4e"
const SPENDER = "0x446d014348a3ef98fd7a91cc1184d4d4a755789f"
const MARKET = "0x86156a8d6e4b9925f7feca527ea5d71b0deedb64"
const amt = (n: number | bigint) => "0x" + BigInt(n).toString(16).padStart(64, "0")

// The one real Approval event, as eth_getLogs returned it on 2026-10-06 (trimmed to the fields we read).
const REAL = {
  address: STORAGE.toLowerCase(),
  topics: [APPROVAL_TOPIC, pad(OWNER), pad(SPENDER)],
  data: amt(3),
  blockNumber: "0x18eb34e",
  logIndex: "0x2b2",
  transactionHash: "0xa046d322d8134eb05a0a754f495979a9f501873e41a4136f786edfa3754d4473",
}
const log = (over: Record<string, unknown> = {}) => ({ ...REAL, ...over })

describe("plan.ts stays a byte-for-byte copy", () => {
  it("lib/pixel-approvals.ts === supabase/functions/approvals-refresh/plan.ts", () => {
    assert.equal(readFileSync("supabase/functions/approvals-refresh/plan.ts", "utf8"), readFileSync("lib/pixel-approvals.ts", "utf8"))
  })
})

describe("parseApprovalLogs", () => {
  it("reads the real event", () => {
    assert.deepEqual(parseApprovalLogs([REAL], STORAGE), [{ owner: OWNER, spender: SPENDER, amount: "3", block: 26129230, logIndex: 690, tx: REAL.transactionHash }])
  })
  it("keeps uint256 amounts exact (unlimited approvals do not lose digits)", () => {
    const max = (BigInt(1) << BigInt(256)) - BigInt(1)
    assert.equal(parseApprovalLogs([log({ data: amt(max) })], STORAGE)[0].amount, max.toString())
  })
  it("skips other contracts, other events, removed (reorged) logs and malformed fields", () => {
    const bad = [
      log({ address: "0x0000000000000000000000000000000000000001" }),
      log({ topics: ["0x" + "1".repeat(64), pad(OWNER), pad(SPENDER)] }),
      log({ removed: true }),
      log({ topics: [APPROVAL_TOPIC, OWNER, pad(SPENDER)] }),
      log({ data: "0x03" }),
      log({ transactionHash: "0x12" }),
    ]
    assert.deepEqual(parseApprovalLogs(bad, STORAGE), [])
    assert.deepEqual(parseApprovalLogs(null, STORAGE), [])
  })
})

describe("latestPerPair", () => {
  it("keeps the newest event per owner and spender (a revoke after an approve wins)", () => {
    const evs = parseApprovalLogs([log(), log({ blockNumber: "0x18eb350", data: amt(0) }), log({ topics: [APPROVAL_TOPIC, pad(OWNER), pad(MARKET)] })], STORAGE)
    const latest = latestPerPair(evs)
    assert.equal(latest.length, 2)
    assert.equal(latest.find((e) => e.spender === SPENDER)?.amount, "0")
  })
  it("same block: the later log index wins", () => {
    const evs = parseApprovalLogs([log({ logIndex: "0x5", data: amt(9) }), log({ logIndex: "0x4", data: amt(1) })], STORAGE)
    assert.equal(latestPerPair(evs)[0].amount, "9")
  })
})

describe("scanRanges", () => {
  it("covers the span in inclusive chunks", () => {
    assert.deepEqual(scanRanges(10, 2509, 1000), [[10, 1009], [1010, 2009], [2010, 2509]])
    assert.deepEqual(scanRanges(5, 5, 1000), [[5, 5]])
    assert.deepEqual(scanRanges(6, 5, 1000), [])
  })
})

describe("buildApprovalRows", () => {
  it("labels official contracts, puts live unofficial approvals first, and trusts the live read over the index", () => {
    const rows = buildApprovalRows(
      [{ spender: MARKET, amount: "10" }, { spender: SPENDER, amount: "3" }, { spender: "0x00000000000000000000000000000000000000aa", amount: "5" }],
      new Map([[MARKET, "10"], [SPENDER, "3"], ["0x00000000000000000000000000000000000000aa", "0"]]),
    )
    assert.deepEqual(rows.map((r) => [r.spender, r.official]), [[SPENDER, false], [MARKET, true], ["0x00000000000000000000000000000000000000aa", false]])
    assert.equal(rows[1].label, "NormiesPixelMarket (official)")
    assert.equal(rows.filter(isActiveApproval).length, 2)
  })
  it("flags unlimited approvals", () => {
    const big = ((BigInt(1) << BigInt(256)) - BigInt(1)).toString()
    assert.equal(buildApprovalRows([{ spender: SPENDER, amount: big }], new Map([[SPENDER, big]]))[0].unlimited, true)
  })
  it("a failed live read falls back to the indexed amount, never to zero", () => {
    const rows = buildApprovalRows([{ spender: SPENDER, amount: "3" }], new Map([[SPENDER, null]]))
    assert.equal(rows[0].live, null)
    assert.equal(isActiveApproval(rows[0]), true)
  })
})
