/**
 * Refresh normie_index's MOVING columns from the official bulk rarity list: action_points, level, customized, and burned.
 *
 *   npx tsx scripts/refresh-census.ts                       # DRY RUN (default): reads, plans, compares the census, writes NOTHING
 *   npx tsx scripts/refresh-census.ts --compare 27990       # also print how close the census gets to a reference total
 *   npx tsx scripts/refresh-census.ts --apply               # writes the plan (needs SUPABASE_SERVICE_ROLE_KEY in .env.local)
 *
 * Source: GET /rarity/normies (71 pages of 100, about 100 seconds at the polite 0.75 req/s) guarded by /rarity/stats
 * (fetched must equal total and it must not be mid-run) and cross-checked with /history/stats (burned count).
 * It does NOT touch owner, delegate, on_pixels or indexed_at (the bulk list has no owners). A token is only marked burned when the
 * list is COMPLETE and consistent (see lib/census-refresh.ts); otherwise only action points / edited art are written.
 */
import fs from "fs"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import { applyPlanToRows, planCensusRefresh, type BulkRow, type IndexRowLite } from "../lib/census-refresh"
import { fetchWithRetry } from "../lib/fetch-with-retry"
import { walletScore } from "../lib/burn-buy/score"

for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "")
}
const APPLY = process.argv.includes("--apply")
const cmpIdx = process.argv.indexOf("--compare")
const COMPARE = cmpIdx > -1 ? Number(process.argv[cmpIdx + 1]) : null
const API = "https://api.normies.art"
const DELAY_MS = 1350 // about 0.75 requests a second, under the documented 60 a minute
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function getJson<T>(path: string): Promise<T> {
  const res = await fetchWithRetry(API + path, {}, 20_000, { attempts: 3 })
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`)
  return (await res.json()) as T
}

type Item = { id: number | string; attributes?: Array<{ trait_type: string; value: string | number }> }
const attr = (it: Item, name: string) => it.attributes?.find((a) => a.trait_type === name)?.value

type FullRow = IndexRowLite & { owner: string | null }
const census = (rows: FullRow[]) => {
  const w = new Map<string, { n: number; ap: number }>()
  for (const r of rows) {
    if (r.burned || !r.owner) continue
    const x = w.get(r.owner) ?? { n: 0, ap: 0 }
    x.n++; x.ap += r.action_points ?? 0; w.set(r.owner, x)
  }
  let total = 0
  for (const x of w.values()) total += walletScore(x.n, x.ap)
  return { total, wallets: w.size, living: rows.filter((r) => !r.burned).length, ap: rows.filter((r) => !r.burned).reduce((s, r) => s + (r.action_points ?? 0), 0) }
}

async function readAllIndex(db: Pick<SupabaseClient, "from">): Promise<FullRow[]> {
  const chunks = await Promise.all(Array.from({ length: 10 }, (_, i) => i * 1000).map(async (from) => {
    const { data, error } = await db.from("normie_index").select("token_id,owner,action_points,level,customized,burned").gte("token_id", from).lt("token_id", from + 1000).order("token_id")
    if (error) throw new Error(error.message)
    return (data ?? []) as FullRow[]
  }))
  return chunks.flat()
}

async function main() {
  console.log(APPLY ? "APPLY (will write)" : "DRY RUN (writes nothing)")
  const url = process.env.SUPABASE_URL
  const key = APPLY ? process.env.SUPABASE_SERVICE_ROLE_KEY : process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY
  if (!url || !key) throw new Error(APPLY ? "--apply needs SUPABASE_SERVICE_ROLE_KEY" : "missing SUPABASE_URL / key")
  const db = createClient(url, key, { auth: { persistSession: false } })

  const stats = await getJson<{ fetched: number; total: number; burned: number; supply: number; running: boolean; lastSaved?: string }>("/rarity/stats")
  console.log(`rarity/stats: fetched ${stats.fetched} of ${stats.total}, burned ${stats.burned}, running=${stats.running}, lastSaved ${stats.lastSaved}`)
  if (stats.fetched !== stats.total || stats.running) throw new Error("the API's rarity list is not settled (fetched != total or still running); try again in a few minutes")
  const hist = await getJson<{ totalBurnedTokens: number }>("/history/stats")
  console.log(`history/stats: ${hist.totalBurnedTokens} burned tokens (rarity says ${stats.burned}; ${hist.totalBurnedTokens === stats.burned ? "they agree" : "THEY DISAGREE"})`)

  const first = await getJson<{ items: Item[]; totalPages: number; total: number }>("/rarity/normies?limit=100&page=1&sort=rank&order=asc")
  const pages = first.totalPages
  const bulk: BulkRow[] = []
  let pagesOk = true
  const take = (items: Item[]) => { for (const it of items) bulk.push({ id: Number(it.id), actionPoints: Number(attr(it, "Action Points") ?? 0), level: attr(it, "Level") === undefined ? null : Number(attr(it, "Level")), customized: attr(it, "Customized") === "Yes" }) }
  take(first.items)
  for (let p = 2; p <= pages; p++) {
    await sleep(DELAY_MS)
    try { take((await getJson<{ items: Item[] }>(`/rarity/normies?limit=100&page=${p}&sort=rank&order=asc`)).items) }
    catch (e) { pagesOk = false; console.log(`  page ${p} FAILED: ${e instanceof Error ? e.message : e}`) }
    if (p % 10 === 0) console.log(`  page ${p}/${pages}`)
  }
  console.log(`bulk list: ${bulk.length} tokens from ${pages} pages (pagesOk=${pagesOk})`)

  const index = await readAllIndex(db)
  const plan = planCensusRefresh(bulk, index, { expectedLiving: stats.total, pagesOk })
  const apMoved = plan.updates.filter((u) => (index.find((r) => r.token_id === u.token_id)?.action_points ?? 0) !== u.action_points).length
  const custMoved = plan.updates.filter((u) => Boolean(index.find((r) => r.token_id === u.token_id)?.customized) !== u.customized).length
  const before = census(index), after = census(applyPlanToRows(index, plan))

  console.log(`\nindex rows: ${index.length} (${before.living} living)`)
  console.log(`plan: ${plan.updates.length} rows to update (${apMoved} AP changed, ${custMoved} edited-art flag changed) | ${plan.unchanged} unchanged | ${plan.notInIndex.length} not in index`)
  console.log(`burned since the index was built: ${plan.burned.length} -> ${plan.burnedGuardOk ? "will be marked burned" : `NOT marked (guard: ${plan.burnedGuardWhy})`}`)
  console.log(`\nCENSUS (sum of every wallet's score, owners as stored):`)
  console.log(`  before: living ${before.living}, wallets ${before.wallets}, total AP ${before.ap}, score total ${before.total.toFixed(1)}`)
  console.log(`  after : living ${after.living}, wallets ${after.wallets}, total AP ${after.ap}, score total ${after.total.toFixed(1)}`)
  if (COMPARE) console.log(`  reference ${COMPARE}: before is ${((before.total / COMPARE - 1) * 100).toFixed(1)}% off, after is ${((after.total / COMPARE - 1) * 100).toFixed(1)}% off`)

  if (!APPLY) { console.log("\nDRY RUN: nothing written. Re-run with --apply."); return }

  let done = 0
  for (let i = 0; i < plan.updates.length; i += 20) {
    await Promise.all(plan.updates.slice(i, i + 20).map(async (u) => {
      const { error } = await db.from("normie_index").update({ action_points: u.action_points, level: u.level, customized: u.customized }).eq("token_id", u.token_id)
      if (error) throw new Error(`update #${u.token_id}: ${error.message}`)
    }))
    done += Math.min(20, plan.updates.length - i)
  }
  console.log(`\nwrote ${done} row updates`)
  if (plan.burnedGuardOk && plan.burned.length) {
    const { error } = await db.from("normie_index").update({ burned: true, owner: null }).in("token_id", plan.burned)
    if (error) throw new Error(`mark burned: ${error.message}`)
    console.log(`marked ${plan.burned.length} tokens burned`)
  }
  const verify = await readAllIndex(db)
  const again = planCensusRefresh(bulk, verify, { expectedLiving: stats.total, pagesOk })
  const c = census(verify)
  console.log(`\nVERIFY (re-read the table): ${again.updates.length} updates still pending, ${again.burned.length} still-living-but-burned; living ${c.living}, wallets ${c.wallets}, total AP ${c.ap}, score total ${c.total.toFixed(1)}`)
  if (again.updates.length || (plan.burnedGuardOk && again.burned.length)) throw new Error("verification found leftovers")
}
main().catch((e) => { console.error(e); process.exit(1) })
