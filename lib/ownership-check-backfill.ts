// One-off backfill of normie_index.owner_since from the Normies contract's Transfer logs (spec: pulse-trust-fixes-spec.md, 1.2).
// Read-only on-chain (eth_getLogs and block headers); the only write is the owner_since column in NCH's own index.
//
// It scans the last 30 days in 1,000-block chunks (the SCAN_CHUNK pattern from lib/pixel-approvals.ts: about 216 calls in total, not
// per token). A serverless call can't do all of that in one go, so each call scans a slice, oldest first, and answers with the
// cursor for the next call. Safe to repeat: owner_since is only ever set when it is empty or older than the transfer found, so a
// re-run, or a date the owners-refresh job has set since, is never moved backwards.
//  - A token transferred in the window gets the block time of its latest transfer.
//  - A token with no transfer in the window gets the window start, written by the last call (enough to pass a 30-day rule).

import { parseAbiItem } from "viem"

import { NORMIES_NFT } from "@/constants/contracts"
import { getPrivateDb } from "@/lib/db/supabase"
import { mapLimit } from "@/lib/map-limit"
import { SCAN_CHUNK, scanRanges } from "@/lib/pixel-approvals"
import { isAuthorizedCron } from "@/lib/security/cron-auth"
import { publicClient } from "@/lib/viem-client"

import { OWNER_TENURE_DAYS } from "./ownership-check"

/** Ethereum makes at most one block every 12 seconds, so this many blocks cover at least OWNER_TENURE_DAYS days. */
export const WINDOW_BLOCKS = Math.ceil((OWNER_TENURE_DAYS * 86_400) / 12)
/** 1,000-block chunks scanned per call. */
export const DEFAULT_CHUNKS_PER_CALL = 30
export const MAX_CHUNKS_PER_CALL = 60

export interface TransferEvent { tokenId: number; block: number; logIndex: number }

export type BackfillCursor = { from: number; to: number; next: number }

export type BackfillDeps = {
  latestBlock: () => Promise<number>
  /** Block time in unix seconds. */
  blockTime: (block: number) => Promise<number>
  /** Transfer events of the Normies contract in [from, to], inclusive. */
  transferLogs: (from: number, to: number) => Promise<TransferEvent[]>
  /** Set owner_since for one token, only when it is empty or older than `iso`. */
  raiseOwnerSince: (tokenId: number, iso: string) => Promise<void>
  /** Set owner_since = iso on every living row where it is still empty. Returns how many rows. */
  fillEmpty: (iso: string) => Promise<number>
  now: () => Date
}

export type BackfillSummary = {
  ok: true
  dry: boolean
  done: boolean
  window: { from_block: number; to_block: number; start: string }
  scanned: { from_block: number; to_block: number } | null
  transfers_seen: number
  tokens_set: number
  /** Rows given the window start. Only on the last call; null before that and on a dry run. */
  filled_with_window_start: number | null
  /** Query string for the next call, or null when done. */
  next: string | null
}

export type BackfillResult =
  | { status: 200; body: BackfillSummary }
  | { status: 400 | 401 | 503; body: { ok: false; error: string } }

/** The newest transfer per token: later block wins, then later log index. Malformed token ids are skipped, never guessed. */
export function latestTransferPerToken(events: readonly TransferEvent[]): Map<number, TransferEvent> {
  const best = new Map<number, TransferEvent>()
  for (const e of events) {
    if (!Number.isInteger(e.tokenId) || e.tokenId < 0 || e.tokenId > 9999) continue
    if (!Number.isInteger(e.block) || !Number.isInteger(e.logIndex)) continue
    const have = best.get(e.tokenId)
    if (!have || e.block > have.block || (e.block === have.block && e.logIndex > have.logIndex)) best.set(e.tokenId, e)
  }
  return best
}

const wholeNumber = (v: string | null): number | null => (v !== null && /^\d{1,12}$/.test(v) ? Number(v) : null)

/** The cursor from the query string. null = first call (no cursor); "bad" = present but not usable. */
export function parseCursor(q: URLSearchParams): BackfillCursor | null | "bad" {
  if (!q.has("from") && !q.has("to") && !q.has("next")) return null
  const from = wholeNumber(q.get("from"))
  const to = wholeNumber(q.get("to"))
  const next = wholeNumber(q.get("next"))
  if (from === null || to === null || next === null) return "bad"
  // Twice the window is the most a first call can ever choose (it only steps back a little to cover the full 30 days).
  if (from > to || next < from || next > to + 1 || to - from > WINDOW_BLOCKS * 2) return "bad"
  return { from, to, next }
}

/** First call: the window ends at the latest block and starts far enough back that its first block is at least 30 days old. */
async function chooseWindow(deps: BackfillDeps): Promise<{ from: number; to: number }> {
  const to = await deps.latestBlock()
  const wantStart = deps.now().getTime() / 1000 - OWNER_TENURE_DAYS * 86_400
  let from = Math.max(0, to - WINDOW_BLOCKS)
  for (let step = 0; step < 40 && from > 0; step++) {
    if ((await deps.blockTime(from)) <= wantStart) return { from, to }
    from = Math.max(0, from - SCAN_CHUNK)
  }
  if ((await deps.blockTime(from)) <= wantStart) return { from, to }
  throw new Error("could not find a block 30 days back")
}

export async function runOwnerSinceBackfill(
  authorization: string | null,
  cronSecret: string | undefined,
  query: URLSearchParams,
  makeDeps: () => BackfillDeps | null,
): Promise<BackfillResult> {
  // Auth first: nothing is built or read for a caller without the secret.
  if (!isAuthorizedCron(authorization, cronSecret)) return { status: 401, body: { ok: false, error: "Unauthorized" } }
  const deps = makeDeps()
  if (!deps) return { status: 503, body: { ok: false, error: "The database write key is not configured" } }

  const cursor = parseCursor(query)
  if (cursor === "bad") return { status: 400, body: { ok: false, error: "Bad cursor: pass from, to and next exactly as the last answer gave them" } }
  const dry = query.get("dry") === "1"
  const asked = wholeNumber(query.get("chunks"))
  const chunks = Math.min(MAX_CHUNKS_PER_CALL, Math.max(1, asked ?? DEFAULT_CHUNKS_PER_CALL))

  try {
    let window: { from: number; to: number }
    if (cursor) {
      if (cursor.to > (await deps.latestBlock())) return { status: 400, body: { ok: false, error: "Bad cursor: the window ends after the latest block" } }
      window = { from: cursor.from, to: cursor.to }
    } else {
      window = await chooseWindow(deps)
    }
    const next = cursor ? cursor.next : window.from
    const windowStart = new Date((await deps.blockTime(window.from)) * 1000).toISOString()

    const ranges = scanRanges(next, window.to).slice(0, chunks)
    const logs = (await mapLimit(ranges, 3, ([a, b]) => deps.transferLogs(a, b))).flat()
    const latest = [...latestTransferPerToken(logs).values()]

    // One header read per distinct block, then one guarded write per token.
    const blocks = [...new Set(latest.map((e) => e.block))]
    const times = new Map<number, number>()
    await mapLimit(blocks, 6, async (b) => { times.set(b, await deps.blockTime(b)) })
    if (!dry) {
      await mapLimit(latest, 10, async (e) => {
        const t = times.get(e.block)
        if (t === undefined || !Number.isFinite(t)) throw new Error("missing block time")
        await deps.raiseOwnerSince(e.tokenId, new Date(t * 1000).toISOString())
      })
    }

    const scannedTo = ranges.length > 0 ? ranges[ranges.length - 1][1] : next - 1
    const done = scannedTo >= window.to
    const filled = done && !dry ? await deps.fillEmpty(windowStart) : null
    const nextQuery = done ? null : `from=${window.from}&to=${window.to}&next=${scannedTo + 1}${dry ? "&dry=1" : ""}`

    return {
      status: 200,
      body: {
        ok: true,
        dry,
        done,
        window: { from_block: window.from, to_block: window.to, start: windowStart },
        scanned: ranges.length > 0 ? { from_block: next, to_block: scannedTo } : null,
        transfers_seen: logs.length,
        tokens_set: dry ? 0 : latest.length,
        filled_with_window_start: filled,
        next: nextQuery,
      },
    }
  } catch {
    // No upstream error text. Nothing is lost: repeat the same call (every write is guarded, see the header).
    return { status: 503, body: { ok: false, error: "Backfill step did not complete. Repeat the same call." } }
  }
}

const TRANSFER = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)")

/** The real reads and writes. Null without the service-role key: the public key can't write the index, and must not be tried. */
export function defaultBackfillDeps(env: Record<string, string | undefined> = process.env): BackfillDeps | null {
  if (!env.SUPABASE_SERVICE_ROLE_KEY?.trim()) return null
  const db = getPrivateDb()
  if (!db) return null
  return {
    latestBlock: async () => Number(await publicClient.getBlockNumber()),
    blockTime: async (block) => Number((await publicClient.getBlock({ blockNumber: BigInt(block) })).timestamp),
    transferLogs: async (from, to) => {
      const logs = await publicClient.getLogs({ address: NORMIES_NFT, event: TRANSFER, fromBlock: BigInt(from), toBlock: BigInt(to) })
      return logs
        .filter((l) => l.args.tokenId !== undefined && l.args.tokenId <= BigInt(9999) && l.blockNumber !== null && l.logIndex !== null)
        .map((l) => ({ tokenId: Number(l.args.tokenId), block: Number(l.blockNumber), logIndex: Number(l.logIndex) }))
    },
    raiseOwnerSince: async (tokenId, iso) => {
      const empty = await db.from("normie_index").update({ owner_since: iso }).eq("token_id", tokenId).is("owner_since", null)
      if (empty.error) throw new Error("owner_since write failed")
      const older = await db.from("normie_index").update({ owner_since: iso }).eq("token_id", tokenId).lt("owner_since", iso)
      if (older.error) throw new Error("owner_since write failed")
    },
    fillEmpty: async (iso) => {
      // An exact count rather than returned rows: the API caps how many rows one answer can carry.
      const { count, error } = await db.from("normie_index").update({ owner_since: iso }, { count: "exact" }).eq("burned", false).is("owner_since", null)
      if (error) throw new Error("owner_since fill failed")
      return count ?? 0
    },
    now: () => new Date(),
  }
}
