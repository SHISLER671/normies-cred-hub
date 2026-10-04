// Scheduled job (pg_cron -> pg_net): refresh normie_index.owner from the chain (ownerOf for every living token via Multicall3),
// with the same guards as scripts/refresh-owners.ts. plan.ts is a byte-for-byte copy of lib/owners-refresh.ts (a test fails if they drift).
// Only the cron secret in public.sync_config can trigger it. `?dry=1` plans and returns, writes nothing.
import { createClient } from "npm:@supabase/supabase-js@2"
import { createPublicClient, fallback, http, parseAbi } from "npm:viem@2"
import { mainnet } from "npm:viem@2/chains"
import { planOwnersRefresh } from "./plan.ts"

const NORMIES_NFT = "0x9eb6e2025b64f340691e424b7fe7022ffde12438" as const
const abi = parseAbi(["function ownerOf(uint256 tokenId) view returns (address)"])
const chain = createPublicClient({
  chain: mainnet,
  transport: fallback([http("https://ethereum.publicnode.com"), http("https://eth.llamarpc.com"), http("https://rpc.ankr.com/eth")]),
})
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
const same = (a: string, b: string) => a.length === b.length && [...a].reduce((d, c, i) => d | (c.charCodeAt(0) ^ b.charCodeAt(i)), 0) === 0

async function run(db: ReturnType<typeof createClient>, dry: boolean) {
  const chunks = await Promise.all(Array.from({ length: 10 }, (_, i) => i * 1000).map(async (from) => {
    const { data, error } = await db.from("normie_index").select("token_id,owner,burned").gte("token_id", from).lt("token_id", from + 1000).order("token_id")
    if (error) throw new Error(error.message)
    return data ?? []
  }))
  const index = chunks.flat()
  const living = index.filter((r: { burned: boolean }) => !r.burned)

  // Public RPCs sometimes fail part of a big batch: ask again for just the failures, in smaller batches.
  const owners = new Map<number, string | null>(living.map((r: { token_id: number }) => [r.token_id, null]))
  let pending = living.map((r: { token_id: number }) => r.token_id)
  for (let pass = 1; pass <= 4 && pending.length > 0; pass++) {
    const results = await chain.multicall({
      contracts: pending.map((id: number) => ({ address: NORMIES_NFT, abi, functionName: "ownerOf" as const, args: [BigInt(id)] })),
      allowFailure: true,
      batchSize: pass === 1 ? 16_000 : 4_000,
    })
    pending.forEach((id: number, i: number) => { const r = results[i]; if (r.status === "success") owners.set(id, String(r.result)) })
    pending = pending.filter((id: number) => !owners.get(id))
    if (pending.length > 0) await sleep(2500 * pass)
  }

  const plan = planOwnersRefresh(owners, index)
  const summary = { living: living.length, changed: plan.updates.length, unchanged: plan.unchanged, lookupsFailed: plan.unknown.length, guard: plan.why }
  if (dry) return { dry: true, ok: plan.ok, ...summary }
  if (!plan.ok) throw new Error(plan.why)

  for (let i = 0; i < plan.updates.length; i += 20) {
    await Promise.all(plan.updates.slice(i, i + 20).map(async (u) => {
      const { error } = await db.from("normie_index").update({ owner: u.owner }).eq("token_id", u.token_id)
      if (error) throw new Error(`update #${u.token_id}: ${error.message}`)
    }))
  }
  return summary
}

/** synced_at only moves forward on success, so a failing job shows up as an old stamp rather than a fresh one. */
async function stamp(db: ReturnType<typeof createClient>, ok: boolean, summary: Record<string, unknown>) {
  const now = new Date().toISOString()
  if (ok) { await db.from("census_sync").upsert({ job: "owners", synced_at: now, ok: true, summary }); return }
  const { data } = await db.from("census_sync").select("job").eq("job", "owners").maybeSingle()
  if (data) await db.from("census_sync").update({ ok: false, summary }).eq("job", "owners")
  else await db.from("census_sync").insert({ job: "owners", synced_at: "1970-01-01T00:00:00Z", ok: false, summary })
}

Deno.serve(async (req) => {
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } })
  const { data: cfg } = await db.from("sync_config").select("value").eq("key", "cron_secret").maybeSingle()
  if (!cfg || !same(req.headers.get("x-cron-secret") ?? "", cfg.value)) return json({ error: "unauthorized" }, 401)

  const dry = new URL(req.url).searchParams.get("dry") === "1"
  try {
    const summary = await run(db, dry)
    if (!dry) await stamp(db, true, summary)
    return json(summary)
  } catch (e) {
    const summary = { error: String(e instanceof Error ? e.message : e) }
    if (!dry) await stamp(db, false, summary)
    return json(summary, 500)
  }
})
