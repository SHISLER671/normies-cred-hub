/**
 * Refresh normie_index.owner from the chain: ownerOf for every living token, in Multicall3 batches.
 *
 *   npx tsx scripts/refresh-owners.ts            # DRY RUN (default): reads the chain and the index, writes NOTHING
 *   npx tsx scripts/refresh-owners.ts --apply    # writes the changed owners (needs SUPABASE_SERVICE_ROLE_KEY in .env.local)
 *
 * Only `owner` is written. A failed lookup leaves that row untouched, and the plan refuses to write at all when many
 * lookups failed or an implausible number of owners changed (lib/owners-refresh.ts).
 */
import fs from "fs"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { createPublicClient, fallback, http, parseAbi } from "viem"
import { mainnet } from "viem/chains"

import { NORMIES_NFT } from "../constants/contracts"
import { planOwnersRefresh, type OwnerRowLite } from "../lib/owners-refresh"
import { walletScore } from "../lib/burn-buy/score"

for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "")
}
const APPLY = process.argv.includes("--apply")

const chain = createPublicClient({
  chain: mainnet,
  transport: fallback([http("https://ethereum.publicnode.com"), http("https://eth.llamarpc.com"), http("https://rpc.ankr.com/eth")]),
})
const abi = parseAbi(["function ownerOf(uint256 tokenId) view returns (address)"])

type Row = OwnerRowLite & { action_points: number | null }

async function readIndex(db: Pick<SupabaseClient, "from">): Promise<Row[]> {
  const chunks = await Promise.all(Array.from({ length: 10 }, (_, i) => i * 1000).map(async (from) => {
    const { data, error } = await db.from("normie_index").select("token_id,owner,action_points,burned").gte("token_id", from).lt("token_id", from + 1000).order("token_id")
    if (error) throw new Error(error.message)
    return (data ?? []) as Row[]
  }))
  return chunks.flat()
}

const census = (rows: Row[]) => {
  const w = new Map<string, { n: number; ap: number }>()
  for (const r of rows) {
    if (r.burned || !r.owner) continue
    const x = w.get(r.owner.toLowerCase()) ?? { n: 0, ap: 0 }
    x.n++; x.ap += r.action_points ?? 0; w.set(r.owner.toLowerCase(), x)
  }
  let total = 0
  for (const x of w.values()) total += walletScore(x.n, x.ap)
  return { wallets: w.size, total }
}

async function main() {
  console.log(APPLY ? "APPLY (will write)" : "DRY RUN (writes nothing)")
  const url = process.env.SUPABASE_URL
  const key = APPLY ? process.env.SUPABASE_SERVICE_ROLE_KEY : process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY
  if (!url || !key) throw new Error(APPLY ? "--apply needs SUPABASE_SERVICE_ROLE_KEY" : "missing SUPABASE_URL / key")
  const db = createClient(url, key, { auth: { persistSession: false } })

  const index = await readIndex(db)
  const living = index.filter((r) => !r.burned)
  console.log(`index: ${index.length} rows, ${living.length} living`)

  // Public RPCs sometimes fail part of a big batch. Ask again for just the failures (smaller batches, a pause between passes).
  const owners = new Map<number, string | null>(living.map((r) => [r.token_id, null]))
  let pending = living.map((r) => r.token_id)
  for (let pass = 1; pass <= 4 && pending.length > 0; pass++) {
    const results = await chain.multicall({
      contracts: pending.map((id) => ({ address: NORMIES_NFT, abi, functionName: "ownerOf" as const, args: [BigInt(id)] })),
      allowFailure: true,
      batchSize: pass === 1 ? 16_000 : 4_000,
    })
    pending.forEach((id, i) => { const res = results[i]; if (res.status === "success") owners.set(id, String(res.result)) })
    pending = pending.filter((id) => !owners.get(id))
    console.log(`  pass ${pass}: ${pending.length} still failing`)
    if (pending.length > 0) await new Promise((r) => setTimeout(r, 2500 * pass))
  }
  console.log(`chain: ${[...owners.values()].filter(Boolean).length} owners read, ${[...owners.values()].filter((v) => !v).length} failed`)

  const plan = planOwnersRefresh(owners, index)
  const afterRows = index.map((r) => { const u = plan.updates.find((x) => x.token_id === r.token_id); return u ? { ...r, owner: u.owner } : r })
  const before = census(index), after = census(afterRows)
  console.log(`\nplan: ${plan.updates.length} owners to change | ${plan.unchanged} unchanged | ${plan.unknown.length} lookups failed${plan.unknown.length ? ` (${plan.unknown.slice(0, 10).join(", ")}${plan.unknown.length > 10 ? "…" : ""})` : ""}`)
  console.log(`guard: ${plan.ok ? "ok" : "REFUSES TO WRITE: " + plan.why}`)
  console.log(`census score total (owners + current AP): before ${before.total.toFixed(1)} over ${before.wallets} wallets, after ${after.total.toFixed(1)} over ${after.wallets} wallets (simulator reference about 27,990)`)

  if (!APPLY) { console.log("\nDRY RUN: nothing written. Re-run with --apply."); return }
  if (!plan.ok) throw new Error("guard refused: " + plan.why)

  for (let i = 0; i < plan.updates.length; i += 20) {
    await Promise.all(plan.updates.slice(i, i + 20).map(async (u) => {
      const { error } = await db.from("normie_index").update({ owner: u.owner }).eq("token_id", u.token_id)
      if (error) throw new Error(`update #${u.token_id}: ${error.message}`)
    }))
  }
  console.log(`\nwrote ${plan.updates.length} owner updates`)
  const verify = await readIndex(db)
  const again = planOwnersRefresh(owners, verify)
  const c = census(verify)
  console.log(`VERIFY (re-read the table): ${again.updates.length} owner updates still pending; census total ${c.total.toFixed(1)} over ${c.wallets} wallets`)
  if (again.updates.length) throw new Error("verification found leftovers")
}
main().catch((e) => { console.error(e); process.exit(1) })
