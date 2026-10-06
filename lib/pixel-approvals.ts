// #PIXEL approvals: the pure half (no I/O). supabase/functions/approvals-refresh/plan.ts is a byte-for-byte copy of this file
// (a test fails if they drift).
//
// Why: NormiesCanvasStorageV2 has an ERC20-style approve. Its own notice says an allowance is custody of that amount: the spender can
// spend it from the holder's wallet OR from a Normie the holder owns (and can list at any price and fill the listing itself). That is
// the classic drainer setup for a new token, so holders need a plain way to see who they have approved. Canvas delegates are NOT a risk
// here: they can only paint, and they stop counting the moment the Normie changes hands (setBy must still be the owner).

/** Approval(address indexed owner, address indexed spender, uint256 amount) */
export const APPROVAL_TOPIC = "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925"

/** NormiesCanvasStorageV2 was created at block 26122420 (2026-10-04 23:56 UTC). The free RPC could no longer serve its first ~1,000
 *  blocks when this index started, so coverage begins here (2026-10-05 ~03:15 UTC, while the contract was still being set up). */
export const APPROVALS_FROM_BLOCK = 26123420

/** Blocks per eth_getLogs call: the free RPC refuses wide ranges. */
export const SCAN_CHUNK = 1000

export interface ApprovalEvent {
  owner: string
  spender: string
  /** Decimal string (uint256 can exceed a JS number). */
  amount: string
  block: number
  logIndex: number
  tx: string
}

const HEX = /^0x[0-9a-fA-F]*$/
const topicAddress = (t: unknown): string | null =>
  typeof t === "string" && /^0x0{24}[0-9a-fA-F]{40}$/.test(t) ? ("0x" + t.slice(26)).toLowerCase() : null

/** Strict: only well-formed Approval logs from `contract`. Anything else is skipped, never guessed. */
export function parseApprovalLogs(logs: unknown, contract: string): ApprovalEvent[] {
  if (!Array.isArray(logs)) return []
  const want = contract.toLowerCase()
  const out: ApprovalEvent[] = []
  for (const l of logs) {
    if (!l || typeof l !== "object") continue
    const r = l as Record<string, unknown>
    if (typeof r.address !== "string" || r.address.toLowerCase() !== want) continue
    if (r.removed === true) continue
    const topics = Array.isArray(r.topics) ? r.topics : []
    if (topics[0] !== APPROVAL_TOPIC) continue
    const owner = topicAddress(topics[1])
    const spender = topicAddress(topics[2])
    if (!owner || !spender) continue
    if (typeof r.data !== "string" || !HEX.test(r.data) || r.data.length !== 66) continue
    if (typeof r.blockNumber !== "string" || !HEX.test(r.blockNumber)) continue
    if (typeof r.logIndex !== "string" || !HEX.test(r.logIndex)) continue
    if (typeof r.transactionHash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(r.transactionHash)) continue
    out.push({
      owner,
      spender,
      amount: BigInt(r.data).toString(),
      block: Number(BigInt(r.blockNumber)),
      logIndex: Number(BigInt(r.logIndex)),
      tx: r.transactionHash.toLowerCase(),
    })
  }
  return out
}

/** The newest event per (owner, spender): later block wins, then later log index. An allowance is simply its latest Approval. */
export function latestPerPair(events: ApprovalEvent[]): ApprovalEvent[] {
  const best = new Map<string, ApprovalEvent>()
  for (const e of events) {
    const k = `${e.owner}|${e.spender}`
    const have = best.get(k)
    if (!have || e.block > have.block || (e.block === have.block && e.logIndex > have.logIndex)) best.set(k, e)
  }
  return [...best.values()].sort((a, b) => a.block - b.block || a.logIndex - b.logIndex)
}

/** Inclusive [from, to] ranges of at most `size` blocks covering from..to. Empty when from > to. */
export function scanRanges(from: number, to: number, size: number = SCAN_CHUNK): Array<[number, number]> {
  const out: Array<[number, number]> = []
  for (let a = from; a <= to; a += size) out.push([a, Math.min(a + size - 1, to)])
  return out
}
