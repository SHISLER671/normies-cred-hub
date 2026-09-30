#!/usr/bin/env node
/**
 * Fill normie_index.on_pixels with each token's ORIGINAL mint pixel count.
 *
 * One request: GET api.normies.art/normie/all/original/pixels returns every token's
 * original pixelCount (docs: "Original raw image data and pixel counts for all indexed
 * tokens", CDN-cached). Nothing per-token, so this is far kinder to their API than a crawl.
 *
 * Note: this is the ORIGINAL count. The active canvas (Zombie art / Canvas transforms) can
 * differ, e.g. #2 is 624 original but 1370 active; /normie/:id/pixels gives the active one.
 *
 *   node scripts/index-pixels.mjs --dry   # fetch + validate, write nothing
 *   node scripts/index-pixels.mjs         # write on_pixels
 */
import { createClient } from "@supabase/supabase-js"
import fs from "fs"

const DRY = process.argv.includes("--dry")
const URL_ALL = "https://api.normies.art/normie/all/original/pixels"

for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}
const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
if (!url || !key) { console.error("missing SUPABASE_URL / key"); process.exit(1) }
const db = createClient(url, key, { auth: { persistSession: false } })

const res = await fetch(URL_ALL, { signal: AbortSignal.timeout(120000) })
if (!res.ok) { console.error(`fetch failed: HTTP ${res.status}`); process.exit(1) }
const { count, tokens } = await res.json()

const rows = []
for (const t of tokens) {
  const id = Number(t.tokenId), px = Number(t.pixelCount)
  if (!Number.isInteger(id) || !Number.isInteger(px) || px < 0 || px > 1600) {
    console.error("bad row, aborting:", id, t.pixelCount); process.exit(1)
  }
  rows.push({ token_id: id, on_pixels: px })
}
if (rows.length !== 10000 || new Set(rows.map(r => r.token_id)).size !== 10000) {
  console.error(`expected 10000 unique tokens, got ${rows.length} (api count ${count})`); process.exit(1)
}
const px = rows.map(r => r.on_pixels)
console.log(`fetched ${rows.length} tokens; on_pixels min ${Math.min(...px)} max ${Math.max(...px)}`)
if (DRY) { console.log("dry run: nothing written"); process.exit(0) }

let written = 0
for (let i = 0; i < rows.length; i += 500) {
  const { error } = await db.from("normie_index").upsert(rows.slice(i, i + 500), { onConflict: "token_id" })
  if (error) { console.error("WRITE FAILED:", error.message); process.exit(1) }
  written += Math.min(500, rows.length - i)
}
console.log(`wrote on_pixels for ${written} tokens`)
