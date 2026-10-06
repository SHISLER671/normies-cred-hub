// Scheduled job (pg_cron -> pg_net), hourly: index #PIXEL Approval events from NormiesCanvasStorageV2 into public.pixel_approvals
// (the latest allowance per owner -> spender), so Pixel Check can show any holder who they have approved.
// The position (last scanned block) lives in public.census_sync (job "approvals", summary.lastBlock). The free RPC only serves recent
// blocks, so the job must keep up: an hourly run reads ~300 new blocks; the watchdog alerts if it stalls.
// plan.ts is a byte-for-byte copy of lib/pixel-approvals.ts (a test fails if they drift).
// Only the cron secret in public.sync_config can trigger it. `?dry=1` scans and returns, writes nothing and does not move the position.
import { createClient } from "npm:@supabase/supabase-js@2"
import { APPROVAL_TOPIC, APPROVALS_FROM_BLOCK, latestPerPair, parseApprovalLogs, scanRanges, type ApprovalEvent } from "./plan.ts"

const RPC = "https://ethereum.publicnode.com"
const STORAGE = "0x96F2DA32Bb9D429d59ac13dB469f4950cBe02084"
/** Stay a few blocks behind the head so a short reorg cannot drop an event we already passed. */
const CONFIRMATIONS = 3
const BUDGET_MS = 90_000
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
const same = (a: string, b: string) => a.length === b.length && [...a].reduce((d, c, i) => d | (c.charCodeAt(0) ^ b.charCodeAt(i)), 0) === 0
const hex = (n: number) => "0x" + n.toString(16)

// deno-lint-ignore no-explicit-any
async function rpc(method: string, params: unknown[]): Promise<any> {
  let last = ""
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(RPC, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(15_000),
      })
      const body = await res.json().catch(() => null)
      if (body && "result" in body) return body.result
      last = body?.error?.message ?? `HTTP ${res.status}`
    } catch (e) {
      last = String(e).slice(0, 80)
    }
    if (attempt < 3) await sleep(800 * attempt)
  }
  throw new Error(`${method}: ${last}`)
}

async function run(db: ReturnType<typeof createClient>, dry: boolean) {
  const started = Date.now()
  const { data: state } = await db.from("census_sync").select("summary").eq("job", "approvals").maybeSingle()
  const saved = Number((state?.summary as { lastBlock?: number } | undefined)?.lastBlock)
  const from = Number.isFinite(saved) && saved >= APPROVALS_FROM_BLOCK ? saved + 1 : APPROVALS_FROM_BLOCK
  const head = Number(BigInt(await rpc("eth_blockNumber", [])))
  const to = head - CONFIRMATIONS

  const events: ApprovalEvent[] = []
  let scannedTo = from - 1
  for (const [a, b] of scanRanges(from, to)) {
    if (scannedTo >= from && Date.now() - started > BUDGET_MS) break
    const logs = await rpc("eth_getLogs", [{ address: STORAGE, topics: [APPROVAL_TOPIC], fromBlock: hex(a), toBlock: hex(b) }])
    events.push(...parseApprovalLogs(logs, STORAGE))
    scannedTo = b
    await sleep(150)
  }

  const latest = latestPerPair(events)
  const summary = { dry, from, lastBlock: Math.max(scannedTo, from - 1), head, caughtUp: scannedTo >= to, events: events.length, pairs: latest.length, coveredFrom: APPROVALS_FROM_BLOCK }
  if (dry || latest.length === 0) return summary

  // Only write a pair when this event is newer than what is stored (a rerun over the same blocks changes nothing).
  const owners = [...new Set(latest.map((e) => e.owner))]
  const { data: rows, error } = await db.from("pixel_approvals").select("owner,spender,block,log_index").in("owner", owners)
  if (error) throw new Error(error.message)
  const stored = new Map<string, { block: number; log_index: number }>(
    (rows ?? []).map((r: { owner: string; spender: string; block: number; log_index: number }) => [`${r.owner}|${r.spender}`, r]),
  )
  const writes = latest.filter((e) => {
    const s = stored.get(`${e.owner}|${e.spender}`)
    return !s || e.block > s.block || (e.block === s.block && e.logIndex > s.log_index)
  })
  if (writes.length) {
    const { error: werr } = await db.from("pixel_approvals").upsert(
      writes.map((e) => ({ owner: e.owner, spender: e.spender, amount: e.amount, block: e.block, log_index: e.logIndex, tx_hash: e.tx, updated_at: new Date().toISOString() })),
    )
    if (werr) throw new Error(`upsert: ${werr.message}`)
  }
  return { ...summary, written: writes.length }
}

/** On success synced_at moves forward with the position; on failure both stay, so the next run retries the same blocks. */
async function stamp(db: ReturnType<typeof createClient>, ok: boolean, summary: Record<string, unknown>) {
  const now = new Date().toISOString()
  const { data: old } = await db.from("census_sync").select("summary").eq("job", "approvals").maybeSingle()
  if (ok) {
    await db.from("census_sync").upsert({ job: "approvals", synced_at: now, ok: true, summary })
    return
  }
  if (old) await db.from("census_sync").update({ ok: false, summary: { ...(old.summary as object), lastError: summary.error, lastErrorAt: now } }).eq("job", "approvals")
  else await db.from("census_sync").insert({ job: "approvals", synced_at: "1970-01-01T00:00:00Z", ok: false, summary: { lastError: summary.error, lastErrorAt: now } })
}

Deno.serve(async (req) => {
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } })
  const { data: cfg } = await db.from("sync_config").select("value").eq("key", "cron_secret").maybeSingle()
  if (!cfg || !same(req.headers.get("x-cron-secret") ?? "", cfg.value)) return json({ error: "unauthorized" }, 401)

  const dry = new URL(req.url).searchParams.get("dry") === "1"
  const job = run(db, dry).then(
    async (summary) => { if (!dry) await stamp(db, true, summary); return summary },
    async (e) => { const summary = { error: String(e instanceof Error ? e.message : e) }; if (!dry) await stamp(db, false, summary); throw e },
  )
  if (dry) {
    try { return json(await job) } catch (e) { return json({ error: String(e instanceof Error ? e.message : e) }, 500) }
  }
  // deno-lint-ignore no-explicit-any
  ;(globalThis as any).EdgeRuntime?.waitUntil(job.catch(() => undefined))
  return json({ accepted: true }, 202)
})
