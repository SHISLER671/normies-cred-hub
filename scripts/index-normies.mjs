#!/usr/bin/env node
/**
 * Index every Normie's owner + action points into public.normie_index.
 *
 * Deliberately slow and polite: api.normies.art is someone else's bill.
 * Default 2 requests/sec total. Resumable — re-running skips tokens
 * indexed within FRESH_HOURS.
 *
 *   node scripts/index-normies.mjs              # full run
 *   node scripts/index-normies.mjs --limit 50   # small test batch
 *   node scripts/index-normies.mjs --rps 1      # even slower
 */
import { createClient } from "@supabase/supabase-js"
import fs from "fs"

const API = "https://api.normies.art"
const TOTAL = 10000
const FRESH_HOURS = 24

const arg = (k, d) => {
  const i = process.argv.indexOf(k)
  return i > -1 ? process.argv[i + 1] : d
}
const LIMIT = Number(arg("--limit", TOTAL))
const RPS = Number(arg("--rps", 2))           // requests/sec across BOTH endpoints
const DELAY = Math.ceil(2000 / RPS)           // 2 requests per token

// env from .env.local without extra deps
for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}
const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
if (!url || !key) { console.error("missing SUPABASE_URL / key"); process.exit(1) }
console.log(`using ${process.env.SUPABASE_SERVICE_ROLE_KEY ? "SERVICE_ROLE" : "SUPABASE_KEY"}`)
const db = createClient(url, key, { auth: { persistSession: false } })

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function getJson(path) {
  try {
    const res = await fetch(API + path, { signal: AbortSignal.timeout(10000) })
    const text = await res.text()
    // Burned tokens answer 502 with {"error":"Ponder API 404: Token not found"}
    if (res.status === 404 || text.includes("Token not found")) return { missing: true }
    if (!res.ok) return { error: res.status }
    try { return JSON.parse(text) } catch { return { error: "bad json" } }
  } catch (e) { return { error: String(e).slice(0, 60) } }
}

// which tokens are already fresh?
const since = new Date(Date.now() - FRESH_HOURS * 3600e3).toISOString()
const { data: fresh } = await db.from("normie_index").select("token_id").gte("indexed_at", since)
const skip = new Set((fresh || []).map(r => r.token_id))
console.log(`already fresh: ${skip.size}`)

let done = 0, burned = 0, errors = 0, batch = []
const t0 = Date.now()

for (let id = 0; id < TOTAL && done < LIMIT; id++) {
  if (skip.has(id)) continue
  const info = await getJson(`/normie/${id}/canvas/info`); await sleep(DELAY / 2)
  const own  = await getJson(`/normie/${id}/owner`);       await sleep(DELAY / 2)

  if (info.error || own.error) { errors++; continue }

  const isBurned = Boolean(own.missing) || own.owner == null
  batch.push({
    token_id: id,
    owner: isBurned ? null : own.owner,
    action_points: info.actionPoints ?? null,
    level: info.level ?? null,
    customized: info.customized ?? null,
    delegate: info.delegate && !/^0x0+$/.test(info.delegate) ? info.delegate : null,
    burned: isBurned,
    indexed_at: new Date().toISOString(),
  })
  if (isBurned) burned++
  done++

  if (batch.length >= 100) {
    const { error } = await db.from("normie_index").upsert(batch, { onConflict: "token_id" })
    if (error) { console.error("WRITE FAILED:", error.message); process.exit(1) }
    batch = []
    const rate = done / ((Date.now() - t0) / 1000)
    const left = Math.round((LIMIT - done) / rate / 60)
    console.log(`  ${done}/${LIMIT}  burned:${burned}  errors:${errors}  ~${left}m left`)
  }
}
if (batch.length) {
  const { error } = await db.from("normie_index").upsert(batch, { onConflict: "token_id" })
  if (error) { console.error("WRITE FAILED:", error.message); process.exit(1) }
}
console.log(`\ndone: ${done} indexed, ${burned} burned/missing, ${errors} errors, ${Math.round((Date.now()-t0)/1000)}s`)
