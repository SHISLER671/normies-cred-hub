// Arena wallet check: the reads (Claude, 2026-11-17). Read-only.
//
// One wallet check makes at most: one ENS read (forward for a name, reverse for an address), `GET /arena/holder/{address}`
// and `GET /arena/status`, the last two through the polite Arena reader (shared 60 s cache, backoff). It never reads a
// Normie one by one, however many the wallet holds.

import { normalize } from "viem/ens"

import { arenaGet } from "@/lib/arena-api"
import { parseAnyRoundStarted, parseArenaLiveRound } from "@/lib/record-card/arena"
import { publicClient } from "@/lib/viem-client"

import { arenaWalletRows, parseArenaHolder, parseWalletQuery, type ArenaRoundContext, type ArenaWalletResult } from "./core"

export const ENS_FORWARD_TIMEOUT_MS = 4_000
export const ENS_REVERSE_TIMEOUT_MS = 2_500

function within<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), ms)
  })
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer))
}

export type ArenaWalletDeps = {
  /** An allowlisted Arena path. Throws when it couldn't be read (network error, pause); an HTTP answer is returned. */
  get: (path: string) => Promise<{ status: number; body: unknown }>
  /** The address a .eth name points to, or null when it points to none. Throws when ENS couldn't be read. */
  resolveEns: (name: string) => Promise<string | null>
  /** The wallet's primary ENS name, or null. Best effort: a failure is null. */
  reverseEns: (address: string) => Promise<string | null>
  now?: () => Date
}

async function getArena(path: string): Promise<{ status: number; body: unknown }> {
  const r = await arenaGet(path)
  if (r.ok) return { status: r.status, body: r.data }
  if (r.reason === "http") return { status: r.status, body: null }
  throw new Error("arena read failed")
}

const DEFAULT_DEPS: ArenaWalletDeps = {
  get: getArena,
  resolveEns: async (name) => (await within(publicClient.getEnsAddress({ name: normalize(name) }), ENS_FORWARD_TIMEOUT_MS)) ?? null,
  reverseEns: async (address) => (await within(publicClient.getEnsName({ address: address as `0x${string}` }), ENS_REVERSE_TIMEOUT_MS)) ?? null,
}

const ADDRESS = /^0x[0-9a-f]{40}$/

/** One wallet check, from what was typed to the answer. Never throws. */
export async function loadArenaWallet(raw: string | null | undefined, deps: ArenaWalletDeps = DEFAULT_DEPS): Promise<ArenaWalletResult> {
  const query = parseWalletQuery(raw)
  if (query.kind === "missing") return { kind: "missing" }
  if (query.kind === "bad") return { kind: "bad_input" }

  let address: string
  let ens: string | null = null
  if (query.kind === "ens") {
    let resolved: string | null
    try {
      resolved = await deps.resolveEns(query.name)
    } catch {
      return { kind: "unavailable", what: "ens" }
    }
    if (resolved === null) return { kind: "ens_not_found" }
    address = resolved.toLowerCase()
    // The address goes into the upstream path, so it is checked again whatever the resolver returned.
    if (!ADDRESS.test(address)) return { kind: "unavailable", what: "ens" }
    ens = query.name
  } else {
    address = query.address
  }

  const asOf = (deps.now ?? (() => new Date()))().toISOString()
  const [holderRead, statusRead, primaryName] = await Promise.all([
    deps.get(`/arena/holder/${address}`).catch(() => null),
    deps.get("/arena/status").catch(() => null),
    ens === null ? deps.reverseEns(address).catch(() => null) : Promise.resolve(ens),
  ])
  const wallet = { address, ens: typeof primaryName === "string" && primaryName.length > 0 && primaryName.length <= 255 ? primaryName : null }

  if (!holderRead) return { kind: "unavailable", what: "arena" }
  if (holderRead.status === 404) return { kind: "not_found", wallet, as_of: asOf }
  if (holderRead.status !== 200) return { kind: "unavailable", what: "arena" }
  const holder = parseArenaHolder(holderRead.body, address)
  if (!holder) return { kind: "unavailable", what: "arena" }
  if (holder.normies.length === 0) return { kind: "empty", wallet, as_of: asOf }

  // A failed status read leaves the round unknown; it never fails the list.
  const statusBody = statusRead && statusRead.status === 200 ? statusRead.body : null
  const ctx: ArenaRoundContext = { live: parseArenaLiveRound(statusBody), anyRoundStarted: parseAnyRoundStarted(statusBody) }
  return { kind: "ok", wallet, as_of: asOf, normies: arenaWalletRows(holder, ctx), counts: { listed: holder.normies.length, ...holder.counts } }
}
