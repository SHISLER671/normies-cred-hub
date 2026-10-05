// Scheduled job (pg_cron -> pg_net): refresh normie_index action_points / level / customized / burned from the official
// bulk rarity list, with the same guards as scripts/refresh-census.ts. plan.ts is a byte-for-byte copy of lib/census-refresh.ts
// (a test fails if they drift). Only the cron secret in public.sync_config can trigger it. `?dry=1` plans and returns, writes nothing.
import { createClient } from "npm:@supabase/supabase-js@2"
import { planCensusRefresh, type BulkRow } from "./plan.ts"

const API = "https://api.normies.art"
const PAGE_DELAY_MS = 1150 // a little under the documented 60 requests a minute
// The platform allows 150 s of wall clock and a full run takes 80 to 115 s. Stop FETCHING before the limit, apply what we have, and say so
// (burned flags are then withheld by the planner and the freshness stamp does not advance), instead of being killed with nothing written.
const BUDGET_MS = 125_000
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })

async function getJson<T>(path: string, deadline = Number.POSITIVE_INFINITY): Promise<T> {
  let last = ""
  for (let attempt = 1; attempt <= 4; attempt++) {
    if (Date.now() > deadline) throw new Error(`${path}: time budget used up`)
    try {
      const res = await fetch(API + path, { signal: AbortSignal.timeout(20_000) })
      if (res.ok) return (await res.json()) as T
      last = `HTTP ${res.status}`
      if (res.status !== 429 && res.status < 500) break
      const wait = Number(res.headers.get("retry-after")) * 1000 || 1500 * attempt
      await sleep(Math.min(wait, 10_000))
    } catch (e) {
      last = String(e)
      await sleep(1500 * attempt)
    }
  }
  throw new Error(`${path}: ${last}`)
}

type Item = { id: number | string; attributes?: Array<{ trait_type: string; value: string | number }> }
const attr = (it: Item, name: string) => it.attributes?.find((a) => a.trait_type === name)?.value

const same = (a: string, b: string) => a.length === b.length && [...a].reduce((d, c, i) => d | (c.charCodeAt(0) ^ b.charCodeAt(i)), 0) === 0

async function run(db: ReturnType<typeof createClient>, dry: boolean) {
  const deadline = Date.now() + BUDGET_MS
  const stats = await getJson<{ fetched: number; total: number; burned: number; running: boolean }>("/rarity/stats")
  if (stats.fetched !== stats.total || stats.running) throw new Error("the official rarity list is not settled (fetched != total or still running)")
  const hist = await getJson<{ totalBurnedTokens: number }>("/history/stats")
  if (hist.totalBurnedTokens !== stats.burned) throw new Error(`burned counts disagree (rarity ${stats.burned}, history ${hist.totalBurnedTokens})`)

  const first = await getJson<{ items: Item[]; totalPages: number }>("/rarity/normies?limit=100&page=1&sort=rank&order=asc")
  const bulk: BulkRow[] = []
  const take = (items: Item[]) => { for (const it of items) bulk.push({ id: Number(it.id), actionPoints: Number(attr(it, "Action Points") ?? 0), level: attr(it, "Level") === undefined ? null : Number(attr(it, "Level")), customized: attr(it, "Customized") === "Yes" }) }
  take(first.items)
  let pagesOk = true
  let truncated = false
  for (let p = 2; p <= first.totalPages; p++) {
    if (Date.now() > deadline) { pagesOk = false; truncated = true; break }
    await sleep(PAGE_DELAY_MS)
    try { take((await getJson<{ items: Item[] }>(`/rarity/normies?limit=100&page=${p}&sort=rank&order=asc`, deadline)).items) } catch { pagesOk = false }
  }

  const chunks = await Promise.all(Array.from({ length: 10 }, (_, i) => i * 1000).map(async (from) => {
    const { data, error } = await db.from("normie_index").select("token_id,action_points,level,customized,burned").gte("token_id", from).lt("token_id", from + 1000).order("token_id")
    if (error) throw new Error(error.message)
    return data ?? []
  }))
  const plan = planCensusRefresh(bulk, chunks.flat(), { expectedLiving: stats.total, pagesOk })
  const summary = { bulk: bulk.length, pagesOk, truncated, updates: plan.updates.length, burnedFound: plan.burned.length, burnedApplied: plan.burnedGuardOk ? plan.burned.length : 0, burnedGuard: plan.burnedGuardWhy, unchanged: plan.unchanged, notInIndex: plan.notInIndex.length }
  if (dry) return { dry: true, ...summary }

  for (let i = 0; i < plan.updates.length; i += 20) {
    await Promise.all(plan.updates.slice(i, i + 20).map(async (u) => {
      const { error } = await db.from("normie_index").update({ action_points: u.action_points, level: u.level, customized: u.customized }).eq("token_id", u.token_id)
      if (error) throw new Error(`update #${u.token_id}: ${error.message}`)
    }))
  }
  if (plan.burnedGuardOk && plan.burned.length) {
    const { error } = await db.from("normie_index").update({ burned: true, owner: null }).in("token_id", plan.burned)
    if (error) throw new Error(`mark burned: ${error.message}`)
  }
  return summary
}

/** synced_at only moves forward on success, so a failing job shows up as an old stamp rather than a fresh one. */
async function stamp(db: ReturnType<typeof createClient>, ok: boolean, summary: Record<string, unknown>) {
  const now = new Date().toISOString()
  if (ok) { await db.from("census_sync").upsert({ job: "census", synced_at: now, ok: true, summary }); return }
  const { data } = await db.from("census_sync").select("job").eq("job", "census").maybeSingle()
  if (data) await db.from("census_sync").update({ ok: false, summary }).eq("job", "census")
  else await db.from("census_sync").insert({ job: "census", synced_at: "1970-01-01T00:00:00Z", ok: false, summary })
}

Deno.serve(async (req) => {
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } })
  const { data: cfg } = await db.from("sync_config").select("value").eq("key", "cron_secret").maybeSingle()
  if (!cfg || !same(req.headers.get("x-cron-secret") ?? "", cfg.value)) return json({ error: "unauthorized" }, 401)

  const dry = new URL(req.url).searchParams.get("dry") === "1"
  const job = run(db, dry).then(
    async (summary) => { if (!dry) await stamp(db, summary.pagesOk, summary); return summary },
    async (e) => { const summary = { error: String(e instanceof Error ? e.message : e) }; if (!dry) await stamp(db, false, summary); throw e },
  )
  if (dry) {
    try { return json(await job) } catch (e) { return json({ error: String(e instanceof Error ? e.message : e) }, 500) }
  }
  // The real run takes about 90 seconds: answer the scheduler at once and finish in the background (the result lands in census_sync).
  // deno-lint-ignore no-explicit-any
  ;(globalThis as any).EdgeRuntime?.waitUntil(job.catch(() => undefined))
  return json({ accepted: true }, 202)
})
