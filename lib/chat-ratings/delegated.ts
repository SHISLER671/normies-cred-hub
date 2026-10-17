// Chat ratings — does a rater control a Normie through delegate.xyz?
//
// Many holders keep Normies in a vault and act from a hot wallet that delegate.xyz points at it (Ryan's own setup).
// Without this check, a holder who rates from the hot wallet counts as a non-holder. Read-only: two registry views plus
// a balance / owner read per claim. Claims are parsed by lib/delegations.ts, the same rules as everywhere else in NCH.

import { claimsFromV1, claimsFromV2, type Claim, type V1Delegation, type V2Delegation } from "@/lib/delegations"

export type DelegatedHolderDeps = {
  readV1: (delegate: `0x${string}`) => Promise<readonly V1Delegation[]>
  readV2: (delegate: `0x${string}`) => Promise<readonly V2Delegation[]>
  /** Normies balance of a vault. */
  vaultBalance: (vault: `0x${string}`) => Promise<bigint>
  /** Current owner of a Normie token. */
  tokenOwner: (tokenId: number) => Promise<string>
}

/** Most claims looked at per rater; a rater with more is judged on the first ones (any one true is enough). */
export const MAX_CLAIMS_PER_RATER = 10

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

/** Does any claim point at a vault that holds a Normie right now? Each claim: true / false / undefined (couldn't read). */
async function claimHolds(c: Claim, deps: DelegatedHolderDeps): Promise<boolean | undefined> {
  try {
    if (c.tokenId === null) return (await deps.vaultBalance(c.vault as `0x${string}`)) > BigInt(0)
    // A single-token delegation counts only while the vault still owns that token (delegations outlive transfers).
    return same(await deps.tokenOwner(c.tokenId), c.vault)
  } catch {
    return undefined
  }
}

/**
 * true  = the rater controls at least one Normie through delegate.xyz (v1 or v2).
 * false = both registries were read and no live delegation covers a Normie.
 * undefined = something could not be read and nothing was confirmed: unknown, never reported as "not a holder".
 */
export async function holdsViaDelegate(rater: `0x${string}`, deps: DelegatedHolderDeps): Promise<boolean | undefined> {
  const [v1, v2] = await Promise.allSettled([deps.readV1(rater), deps.readV2(rater)])
  const claims = [
    ...(v1.status === "fulfilled" ? claimsFromV1(v1.value) : []),
    ...(v2.status === "fulfilled" ? claimsFromV2(v2.value) : []),
  ].slice(0, MAX_CLAIMS_PER_RATER)
  const bothRead = v1.status === "fulfilled" && v2.status === "fulfilled"

  if (!claims.length) return bothRead ? false : undefined

  const results = await Promise.all(claims.map((c) => claimHolds(c, deps)))
  if (results.some((r) => r === true)) return true
  return bothRead && results.every((r) => r === false) ? false : undefined
}
