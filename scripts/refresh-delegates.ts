/**
 * Refresh ONLY normie_index.delegate (the Canvas delegate) from the live API.
 *
 * Canvas delegates can only exist on awakened agents, so this walks /agents/list (~1,900 agents) and reads
 * /normie/{id}/canvas/info for each, plus every token the index already says has a delegate (to catch removals).
 * Same politeness as index-normies.mjs: api.normies.art allows 60 req/min per IP, default here is 0.7 req/s (42/min).
 *
 *   npx tsx scripts/refresh-delegates.ts --limit 100     # DRY RUN (default): read-only, prints the plan, writes nothing
 *   npx tsx scripts/refresh-delegates.ts                 # dry run over every agent (~45 min)
 *   npx tsx scripts/refresh-delegates.ts --apply         # writes `delegate` for CHANGED rows only (needs SERVICE_ROLE key)
 *
 * Failed lookups are "unknown" and never change a row. A delegate that is gone is only written as null after a successful read.
 */
import fs from "fs"
import { createClient } from "@supabase/supabase-js"

import { planDelegateChanges } from "../lib/delegate-refresh"

const API = "https://api.normies.art"
const arg = (k: string, d?: string) => {
  const i = process.argv.indexOf(k)
  return i > -1 ? process.argv[i + 1] : d
}
const APPLY = process.argv.includes("--apply")
const LIMIT = Number(arg("--limit", "100000"))
const MAX_RPS = 0.9
const RPS = Math.min(Number(arg("--rps", "0.7")), MAX_RPS)
if (!(RPS > 0)) { console.error("--rps must be a positive number"); process.exit(1) }
const DELAY = Math.ceil(1000 / RPS)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}
const url = process.env.SUPABASE_URL
const key = APPLY
  ? process.env.SUPABASE_SERVICE_ROLE_KEY
  : process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY
if (!url || !key) { console.error(APPLY ? "--apply needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY" : "missing SUPABASE_URL / key"); process.exit(1) }
const db = createClient(url, key, { auth: { persistSession: false } })
console.log(`${APPLY ? "APPLY (will write)" : "DRY RUN (writes nothing)"} · ${Math.round(RPS * 60)} req/min · limit ${LIMIT} agents`)

async function getJson(path: string): Promise<any | { error: string }> {
  let last = ""
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(API + path, { signal: AbortSignal.timeout(10_000) })
      if (res.ok) return await res.json()
      last = `HTTP ${res.status}`
      if (res.status === 404) return { error: last }
      if (res.status === 429) await sleep(Math.max(5, Number(res.headers.get("retry-after")) || 10) * 1000)
    } catch (e) { last = String(e).slice(0, 60) }
    if (attempt < 3) await sleep(1000 * 2 ** attempt)
  }
  return { error: last }
}

async function main() {
  // 1. which tokens to check
  const agentIds: number[] = []
  for (let cursor: string | null = null; agentIds.length < LIMIT; ) {
    const page = await getJson(`/agents/list?limit=100${cursor ? `&cursor=${cursor}` : ""}`); await sleep(DELAY)
    if (page.error) { console.error("agents/list failed:", page.error); process.exit(1) }
    const items: Array<{ tokenId: string; agentId: string }> = page.items ?? []
    for (const it of items) agentIds.push(Number(it.tokenId))
    if (!page.hasMore || items.length === 0) break
    cursor = items[items.length - 1].agentId
  }
  agentIds.length = Math.min(agentIds.length, LIMIT)

  // 2. what the index says now (paged: Supabase caps a select at 1000 rows)
  const indexed = new Map<number, string | null>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("normie_index").select("token_id,delegate").eq("burned", false).order("token_id").range(from, from + 999)
    if (error) { console.error("index read failed:", error.message); process.exit(1) }
    for (const r of data ?? []) indexed.set(r.token_id, r.delegate)
    if ((data?.length ?? 0) < 1000) break
  }
  const knownDelegated = [...indexed].filter(([, d]) => d).map(([id]) => id)
  const targets = [...new Set([...agentIds, ...knownDelegated])].sort((a, b) => a - b)
  console.log(`agents: ${agentIds.length} · index says delegated: ${knownDelegated.length} · to check: ${targets.length} (~${Math.round(targets.length / RPS / 60)} min)`)

  // 3. live reads
  const observed = new Map<number, string | null | undefined>()
  let n = 0
  for (const id of targets) {
    const info = await getJson(`/normie/${id}/canvas/info`); await sleep(DELAY)
    observed.set(id, info.error ? undefined : info.delegate && !/^0x0+$/.test(info.delegate) ? String(info.delegate).toLowerCase() : null)
    if (++n % 25 === 0) console.log(`  ${n}/${targets.length}`)
  }

  // 4. plan
  const plan = planDelegateChanges(observed, indexed)
  console.log(`\nunchanged ${plan.unchanged} · to change ${plan.changes.length} · unknown (lookup failed, untouched) ${plan.unknown} · not in index ${plan.notInIndex.length}`)
  for (const c of plan.changes) console.log(`  #${c.tokenId} ${c.kind}: ${c.from ?? "none"} -> ${c.to ?? "none"}`)
  if (plan.notInIndex.length) console.log(`  not in index: ${plan.notInIndex.join(", ")}`)

  if (!APPLY) { console.log("\nDRY RUN: nothing written. Re-run with --apply to write the changes above."); process.exit(0) }
  for (const c of plan.changes) {
    const { error } = await db.from("normie_index").update({ delegate: c.to }).eq("token_id", c.tokenId)
    if (error) { console.error(`WRITE FAILED for #${c.tokenId}:`, error.message); process.exit(1) }
  }
  console.log(`\nwrote ${plan.changes.length} row(s).`)
}

main().catch((e) => { console.error(e); process.exit(1) })
