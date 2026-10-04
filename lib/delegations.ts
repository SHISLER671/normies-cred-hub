// Delegate.xyz: which Normies does this wallet control on someone else's behalf?
//
// One implementation for every surface (the connected-wallet hook, the /api/my-normies route, and /burn). It reads BOTH
// registries because they are separate: a delegation made on v1 does not appear in v2's getIncomingDelegations
// (verified on mainnet 2026-10-05: v1.checkDelegateForAll = true while v2.checkDelegateForAll = false for the same pair).
//
// Rules, all checked by tests against real on-chain tuples:
//  - v1 type_ ALL (1) covers every contract (contract_ is the zero address), so it covers Normies; CONTRACT (2) and TOKEN (3) only
//    count when contract_ is the Normies contract. v2 is the same with ERC721 (3) for a single token.
//  - A single-token delegation counts only while the vault STILL holds that token (delegations outlive transfers).
//  - A whole-vault delegation means every Normie the vault holds now.
//  - `rights` is not checked: a scoped delegation still counts as control for read-only advice (a deliberate choice).
//  - A failed read is never an empty answer: it is reported in `checked` / `failedVaults` so callers can say "could not check".

import { getAddress, type PublicClient } from "viem"

import {
  DELEGATE_REGISTRY,
  DELEGATE_REGISTRY_ABI,
  DELEGATE_REGISTRY_V2,
  DELEGATE_REGISTRY_V2_ABI,
  NORMIES_NFT,
} from "@/constants/contracts"

export type Registry = "v1" | "v2"

export interface V1Delegation { type_: number; vault: string; delegate: string; contract_: string; tokenId: bigint }
export interface V2Delegation { type_: number; from: string; contract_: string; tokenId: bigint }

/** tokenId null means "every Normie the vault holds". */
export interface Claim { registry: Registry; vault: string; tokenId: number | null }

export interface Controlled {
  tokenId: number
  vault: string
  registry: Registry
  /** false only when the vault's holdings could not be read, so a single-token claim could not be confirmed. */
  verified: boolean
}

export interface DelegateXyzResult {
  entries: Controlled[]
  /** Vaults whose holdings could not be read: what they hold is unknown, not empty. */
  failedVaults: string[]
  /** false = that registry could not be read, so "no delegations from it" is unknown. */
  checked: { v1: boolean; v2: boolean }
}

const ZERO = "0x0000000000000000000000000000000000000000"
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
const isNormies = (a: string) => same(a, NORMIES_NFT)
const realVault = (v: string) => /^0x[a-fA-F0-9]{40}$/.test(v) && !same(v, ZERO)

export function claimsFromV1(rows: readonly V1Delegation[]): Claim[] {
  const out: Claim[] = []
  for (const r of rows) {
    if (!realVault(r.vault)) continue
    if (r.type_ === 1) out.push({ registry: "v1", vault: r.vault, tokenId: null })
    else if (r.type_ === 2 && isNormies(r.contract_)) out.push({ registry: "v1", vault: r.vault, tokenId: null })
    else if (r.type_ === 3 && isNormies(r.contract_)) out.push({ registry: "v1", vault: r.vault, tokenId: Number(r.tokenId) })
  }
  return out
}

export function claimsFromV2(rows: readonly V2Delegation[]): Claim[] {
  const out: Claim[] = []
  for (const r of rows) {
    if (!realVault(r.from)) continue
    if (r.type_ === 1) out.push({ registry: "v2", vault: r.from, tokenId: null })
    else if (r.type_ === 2 && isNormies(r.contract_)) out.push({ registry: "v2", vault: r.from, tokenId: null })
    else if (r.type_ === 3 && isNormies(r.contract_)) out.push({ registry: "v2", vault: r.from, tokenId: Number(r.tokenId) })
  }
  return out
}

/** Turn claims into the Normies actually controlled, using each vault's CURRENT holdings. */
export async function resolveClaims(
  claims: readonly Claim[],
  holdersOf: (vault: `0x${string}`) => Promise<ReadonlyArray<number | string>>,
): Promise<{ entries: Controlled[]; failedVaults: string[] }> {
  const vaults = [...new Set(claims.map((c) => c.vault.toLowerCase()))]
  const holdings = new Map<string, Set<number> | null>()
  await Promise.all(
    vaults.map(async (v) => {
      try {
        holdings.set(v, new Set((await holdersOf(getAddress(v))).map((n) => Number(n)).filter((n) => Number.isInteger(n))))
      } catch {
        holdings.set(v, null)
      }
    }),
  )

  const byToken = new Map<number, Controlled>()
  const failed = new Set<string>()
  const add = (e: Controlled) => {
    const have = byToken.get(e.tokenId)
    if (!have || (!have.verified && e.verified)) byToken.set(e.tokenId, e)
  }
  for (const c of claims) {
    const held = holdings.get(c.vault.toLowerCase()) ?? null
    const vault = getAddress(c.vault)
    if (c.tokenId === null) {
      if (!held) failed.add(vault)
      else for (const id of held) add({ tokenId: id, vault, registry: c.registry, verified: true })
    } else if (held) {
      if (held.has(c.tokenId)) add({ tokenId: c.tokenId, vault, registry: c.registry, verified: true })
      // else: the vault no longer holds it, so the delegation is stale and grants nothing
    } else {
      add({ tokenId: c.tokenId, vault, registry: c.registry, verified: false })
    }
  }
  return { entries: [...byToken.values()].sort((a, b) => a.tokenId - b.tokenId), failedVaults: [...failed] }
}

export interface DelegateXyzDeps {
  readV1: (delegate: `0x${string}`) => Promise<readonly V1Delegation[]>
  readV2: (delegate: `0x${string}`) => Promise<readonly V2Delegation[]>
  /** Token ids as the API returns them: numbers or numeric strings. */
  holdersOf: (vault: `0x${string}`) => Promise<ReadonlyArray<number | string>>
}

/** Both registries in parallel; one failing never hides what the other found. Never throws. */
export async function findDelegateXyz(address: string, deps: DelegateXyzDeps): Promise<DelegateXyzResult> {
  const delegate = getAddress(address) as `0x${string}`
  const [v1, v2] = await Promise.allSettled([deps.readV1(delegate), deps.readV2(delegate)])
  const claims = [
    ...(v1.status === "fulfilled" ? claimsFromV1(v1.value) : []),
    ...(v2.status === "fulfilled" ? claimsFromV2(v2.value) : []),
  ]
  const { entries, failedVaults } = await resolveClaims(claims, deps.holdersOf)
  return { entries, failedVaults, checked: { v1: v1.status === "fulfilled", v2: v2.status === "fulfilled" } }
}

/** The two registry reads, for any viem public client (server or browser). */
export function registryReaders(client: Pick<PublicClient, "readContract">): Pick<DelegateXyzDeps, "readV1" | "readV2"> {
  return {
    readV1: async (delegate) =>
      (await client.readContract({ address: DELEGATE_REGISTRY, abi: DELEGATE_REGISTRY_ABI, functionName: "getDelegationsByDelegate", args: [delegate] })) as readonly V1Delegation[],
    readV2: async (delegate) =>
      (await client.readContract({ address: DELEGATE_REGISTRY_V2, abi: DELEGATE_REGISTRY_V2_ABI, functionName: "getIncomingDelegations", args: [delegate] })) as readonly V2Delegation[],
  }
}

/** True when nothing could be confirmed AND something could not be read: "none found" must not be reported as a fact. */
export function delegationCheckIncomplete(r: DelegateXyzResult): boolean {
  return !r.checked.v1 || !r.checked.v2 || r.failedVaults.length > 0
}
