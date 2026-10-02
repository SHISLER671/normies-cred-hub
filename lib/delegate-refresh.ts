/** One token's Canvas delegate as seen live (`null` = none) or in the index. Addresses are compared lowercased. */
export type DelegateChange = {
  tokenId: number
  from: string | null
  to: string | null
  kind: "added" | "changed" | "removed"
}

export type DelegatePlan = {
  changes: DelegateChange[]
  unchanged: number
  /** Live lookup failed, so we know nothing about it: never touched. */
  unknown: number
  /** Live data exists but the token has no index row, so there is nothing to update. */
  notInIndex: number[]
}

const norm = (a: string | null | undefined) => (a ? a.toLowerCase() : null)

/**
 * Compare live Canvas delegates with the index. `observed` maps tokenId -> delegate, or `undefined` when the live
 * lookup failed. `indexed` maps tokenId -> delegate currently stored; a token absent from it has no index row.
 */
export function planDelegateChanges(
  observed: Map<number, string | null | undefined>,
  indexed: Map<number, string | null>,
): DelegatePlan {
  const plan: DelegatePlan = { changes: [], unchanged: 0, unknown: 0, notInIndex: [] }
  for (const [tokenId, live] of observed) {
    if (live === undefined) { plan.unknown++; continue }
    if (!indexed.has(tokenId)) { plan.notInIndex.push(tokenId); continue }
    const from = norm(indexed.get(tokenId))
    const to = norm(live)
    if (from === to) { plan.unchanged++; continue }
    plan.changes.push({ tokenId, from, to, kind: from === null ? "added" : to === null ? "removed" : "changed" })
  }
  plan.changes.sort((a, b) => a.tokenId - b.tokenId)
  plan.notInIndex.sort((a, b) => a - b)
  return plan
}
