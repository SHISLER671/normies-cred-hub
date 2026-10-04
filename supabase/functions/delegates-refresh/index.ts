// Scheduled job (pg_cron -> pg_net), hourly: refresh normie_index.delegate (the Canvas delegate) for the NEXT slice of awakened agents.
// Canvas delegates can only exist on awakened agents (~1,900), and the API has no per-wallet lookup that is live yet, so each agent is read
// with /normie/{id}/canvas/info at a polite pace. One run does SLICE agents (about two minutes); the position is kept in public.census_sync
// (job "delegates", summary.nextCursor), and the walk wraps around, so every agent is re-checked about once a day.
// plan.ts is a byte-for-byte copy of lib/delegate-refresh.ts (a test fails if they drift). A failed lookup is "unknown" and never changes a row.
// Only the cron secret in public.sync_config can trigger it. `?dry=1` plans and returns, writes nothing and does not move the position.
import { createClient } from "npm:@supabase/supabase-js@2"
import { planDelegateChanges } from "./plan.ts"

const API = "https://api.normies.art"
const SLICE = 80
const DELAY_MS = 1250 // 0.8 requests a second, under the documented 60 a minute
// The platform allows 150 s of wall clock and a full slice takes about 105 s (132 s was seen once). Stop reading before the limit and move the
// position only as far as we really got, instead of being killed with the position unmoved.
const BUDGET_MS = 100_000
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
const same = (a: string, b: string) => a.length === b.length && [...a].reduce((d, c, i) => d | (c.charCodeAt(0) ^ b.charCodeAt(i)), 0) === 0

// deno-lint-ignore no-explicit-any
async function getJson(path: string): Promise<any> {
  let last = ""
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(API + path, { signal: AbortSignal.timeout(10_000) })
      if (res.ok) return await res.json()
      last = `HTTP ${res.status}`
      if (res.status === 404) return { error: last }
      if (res.status === 429) await sleep(Math.min(Math.max(5, Number(res.headers.get("retry-after")) || 10), 20) * 1000)
    } catch (e) { last = String(e).slice(0, 60) }
    if (attempt < 3) await sleep(1000 * 2 ** attempt)
  }
  return { error: last }
}

type Item = { tokenId: string; agentId: string }

async function run(db: ReturnType<typeof createClient>, dry: boolean) {
  const started = Date.now()
  const { data: state } = await db.from("census_sync").select("summary").eq("job", "delegates").maybeSingle()
  const cursor: string | null = (state?.summary as { nextCursor?: string | null } | undefined)?.nextCursor ?? null

  const page = await getJson(`/agents/list?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`)
  if (page.error) throw new Error(`agents/list: ${page.error}`)
  const all: Item[] = page.items ?? []
  const items = all.slice(0, SLICE)
  if (items.length === 0) return { dry, processed: 0, cycleDone: true, nextCursor: null as string | null, changes: 0, unknown: 0, unchanged: 0, notInIndex: 0, changed: [] as string[] }
  const ids = items.map((it) => Number(it.tokenId))

  const { data: rows, error } = await db.from("normie_index").select("token_id,delegate").eq("burned", false).in("token_id", ids)
  if (error) throw new Error(error.message)
  const indexed = new Map<number, string | null>((rows ?? []).map((r: { token_id: number; delegate: string | null }) => [r.token_id, r.delegate]))

  const observed = new Map<number, string | null | undefined>()
  let done = 0
  for (const id of ids) {
    if (done > 0 && Date.now() - started > BUDGET_MS) break
    await sleep(DELAY_MS)
    const info = await getJson(`/normie/${id}/canvas/info`)
    observed.set(id, info.error ? undefined : info.delegate && !/^0x0+$/.test(info.delegate) ? String(info.delegate).toLowerCase() : null)
    done++
  }

  const plan = planDelegateChanges(observed, indexed)
  const hasMoreAfter = Boolean(page.hasMore) || all.length > done
  const nextCursor = hasMoreAfter ? items[done - 1].agentId : null
  const result = {
    dry, processed: done, cycleDone: !hasMoreAfter, nextCursor, changes: plan.changes.length, unknown: plan.unknown, unchanged: plan.unchanged, notInIndex: plan.notInIndex.length,
    changed: plan.changes.map((c) => `#${c.tokenId} ${c.kind}`),
  }
  if (dry) return result

  for (const c of plan.changes) {
    const { error: werr } = await db.from("normie_index").update({ delegate: c.to }).eq("token_id", c.tokenId)
    if (werr) throw new Error(`update #${c.tokenId}: ${werr.message}`)
  }
  return result
}

/** On success synced_at moves forward and the position advances; on failure the position and synced_at stay, so the next run repeats the same slice. */
async function stamp(db: ReturnType<typeof createClient>, ok: boolean, summary: Record<string, unknown>) {
  const now = new Date().toISOString()
  const { data: old } = await db.from("census_sync").select("summary").eq("job", "delegates").maybeSingle()
  if (ok) {
    const prev = (old?.summary ?? {}) as { cycleCompletedAt?: string }
    await db.from("census_sync").upsert({ job: "delegates", synced_at: now, ok: true, summary: { ...summary, cycleCompletedAt: summary.cycleDone ? now : prev.cycleCompletedAt ?? null } })
    return
  }
  if (old) await db.from("census_sync").update({ ok: false, summary: { ...(old.summary as object), lastError: summary.error, lastErrorAt: now } }).eq("job", "delegates")
  else await db.from("census_sync").insert({ job: "delegates", synced_at: "1970-01-01T00:00:00Z", ok: false, summary: { nextCursor: null, lastError: summary.error, lastErrorAt: now } })
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
  // The real run takes about two minutes: answer the scheduler at once and finish in the background (the result lands in census_sync).
  // deno-lint-ignore no-explicit-any
  ;(globalThis as any).EdgeRuntime?.waitUntil(job.catch(() => undefined))
  return json({ accepted: true }, 202)
})
