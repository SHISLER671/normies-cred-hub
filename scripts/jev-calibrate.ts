/**
 * Calibrate Jev's second opinion on REAL Normies before the marketplace flip.
 *
 * The TypeSafe docs say to test thresholds on your own data. This asks Jev the same question the page asks ("would the holder
 * plausibly regret burning this?") about ~20 Normies from groups where we already know what we would expect, then prints how
 * Jev's regret probability separates them, so REGRET_DOUBLE_CHECK / REGRET_AGREES_BELOW in lib/burn-buy/jev.ts can be set
 * from evidence instead of guesses.
 *
 *   npx tsx scripts/jev-calibrate.ts          # prints what it would send, sends NOTHING
 *   npx tsx scripts/jev-calibrate.ts --yes    # really calls TypeSafe (needs TYPESAFE_API_KEY in .env.local)
 *
 * What is sent: public facts about each Normie (traits, pixel counts, rarity), exactly as the page sends them. Never a wallet
 * address. Costs about 1 to 2 thousand tokens per batch of 8. Nothing is written to the database or to the repo.
 */
import fs from "fs"

for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "")
}

type Group = "collectible" | "customized" | "plain" | "middle"
/** Cut-offs come from the real spread (2026-10-04): a pixel count is shared by about 11 living Normies (busiest 42); median 485 px.
 * What we would EXPECT a sensible second opinion to say, from rules we already trust. */
const EXPECT: Record<Group, string> = {
  collectible: "HIGH regret (tiny pixel count, few alike)",
  customized: "HIGH regret (the owner drew on it)",
  plain: "LOW regret (dense, among the commonest counts)",
  middle: "anywhere (no strong expectation)",
}
const PER_GROUP = 5

/** Evenly spaced picks so the sample is spread out and repeatable, not the first few ids. */
const spread = <T,>(items: T[], n: number): T[] => {
  if (items.length <= n) return items
  return Array.from({ length: n }, (_, i) => items[Math.floor((i * items.length) / n)])
}

async function main() {
  const send = process.argv.includes("--yes")
  const { getSupabase } = await import("../lib/db/supabase")
  const { realDeps } = await import("../lib/burn-buy/data")
  const { fetchJevOpinions, JEV_MAX_TOKENS, REGRET_AGREES_BELOW, REGRET_DOUBLE_CHECK } = await import("../lib/burn-buy/jev")
  type JevToken = import("../lib/burn-buy/jev").JevToken

  const db = getSupabase()
  if (!db) throw new Error("database is not configured (SUPABASE_URL / key in .env.local)")
  const snap = await realDeps.loadSnapshot()
  const { data: custRows, error } = await db.from("normie_index").select("token_id").eq("burned", false).eq("customized", true).order("token_id")
  if (error) throw new Error(error.message)

  const living = [...snap.originalPixels.entries()].map(([id, px]) => ({ id, px, supply: snap.pixelSupply.get(px) ?? 0 })).sort((a, b) => a.id - b.id)
  const customizedIds = new Set((custRows ?? []).map((r) => r.token_id as number))
  const pick: Array<{ id: number; group: Group }> = [
    ...spread(living.filter((t) => t.px < 300 && t.supply <= 20 && !customizedIds.has(t.id)), PER_GROUP).map((t) => ({ id: t.id, group: "collectible" as const })),
    ...spread(living.filter((t) => customizedIds.has(t.id)), PER_GROUP).map((t) => ({ id: t.id, group: "customized" as const })),
    ...spread(living.filter((t) => t.px >= 600 && t.supply >= 14 && !customizedIds.has(t.id)), PER_GROUP).map((t) => ({ id: t.id, group: "plain" as const })),
    ...spread(living.filter((t) => t.px >= 400 && t.px <= 560 && t.supply >= 8 && t.supply <= 25 && !customizedIds.has(t.id)), PER_GROUP).map((t) => ({ id: t.id, group: "middle" as const })),
  ]

  const raw = await realDeps.fetchTokens(pick.map((p) => p.id))
  const rawById = new Map(raw.map((r) => [r.id, r]))
  const tokens: Array<JevToken & { group: Group }> = []
  for (const p of pick) {
    const r = rawById.get(p.id)
    const px = snap.originalPixels.get(p.id)
    if (!r || px === undefined) continue
    tokens.push({
      group: p.group, tokenId: p.id, traits: r.traits ?? {}, originalPixels: px, pixelSupply: snap.pixelSupply.get(px) ?? 0,
      actionPoints: r.actionPoints, level: Math.floor(r.actionPoints / 10) + 1, rank: r.rank, awakenedAgent: r.awakenedAgent, customized: r.customized ?? false,
    })
  }

  console.log(`Picked ${tokens.length} Normies: ${(["collectible", "customized", "plain", "middle"] as Group[]).map((g) => `${tokens.filter((t) => t.group === g).length} ${g}`).join(", ")}`)
  console.log(`Would send ${Math.ceil(tokens.length / JEV_MAX_TOKENS)} requests of up to ${JEV_MAX_TOKENS} Normies each, public facts only, no wallet addresses.`)
  if (!send) {
    console.log("\nDRY RUN: nothing sent. Re-run with --yes to call TypeSafe.")
    for (const t of tokens) console.log(`  #${String(t.tokenId).padEnd(5)} ${t.group.padEnd(11)} ${String(t.originalPixels).padStart(4)} px  ${String(t.pixelSupply).padStart(4)} alike  customized=${t.customized}`)
    return
  }
  const apiKey = process.env.TYPESAFE_API_KEY?.trim()
  if (!apiKey) throw new Error("TYPESAFE_API_KEY is not in .env.local")

  const cache = new Map()
  const results = new Map<number, { pRegret: number; verdict: string }>()
  for (let i = 0; i < tokens.length; i += JEV_MAX_TOKENS) {
    const { opinions } = await fetchJevOpinions(tokens.slice(i, i + JEV_MAX_TOKENS), { apiKey, cache })
    for (const [id, o] of Object.entries(opinions)) results.set(Number(id), o)
  }

  console.log("\n  id    group        px  alike  custom  pRegret  verdict")
  for (const t of tokens) {
    const o = results.get(t.tokenId)
    console.log(`  #${String(t.tokenId).padEnd(5)}${t.group.padEnd(12)}${String(t.originalPixels).padStart(4)}  ${String(t.pixelSupply).padStart(5)}  ${String(t.customized).padEnd(6)}  ${o ? o.pRegret.toFixed(2).padStart(6) : "  none"}   ${o?.verdict ?? "(no opinion)"}`)
  }
  console.log("\nBy group (what we expected -> what Jev said):")
  for (const g of ["collectible", "customized", "plain", "middle"] as Group[]) {
    const ps = tokens.filter((t) => t.group === g).map((t) => results.get(t.tokenId)?.pRegret).filter((x): x is number => x !== undefined)
    const avg = ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : NaN
    const flagged = ps.filter((p) => p >= REGRET_DOUBLE_CHECK).length
    console.log(`  ${g.padEnd(12)} expected ${EXPECT[g].padEnd(48)} -> mean ${avg.toFixed(2)}, min ${Math.min(...ps).toFixed(2)}, max ${Math.max(...ps).toFixed(2)}, flagged double-check ${flagged}/${ps.length}`)
  }
  console.log(`\nCurrent thresholds: double-check at >= ${REGRET_DOUBLE_CHECK}, agrees below ${REGRET_AGREES_BELOW} (untuned starting points).`)
  fs.writeFileSync(`${process.env.HOME}/jev-calibration.json`, JSON.stringify({ at: new Date().toISOString(), thresholds: { REGRET_DOUBLE_CHECK, REGRET_AGREES_BELOW }, rows: tokens.map((t) => ({ id: t.tokenId, group: t.group, px: t.originalPixels, alike: t.pixelSupply, customized: t.customized, ...results.get(t.tokenId) })) }, null, 1))
  console.log(`Saved to ~/jev-calibration.json (outside the repo).`)
}

main().catch((e) => { console.error(e); process.exit(1) })
