// Pulse level 4, "Clean ownership & delegation": the rule itself. Pure: no I/O (the reads live in lib/ownership-check-load.ts).
// Spec: docs/zulo/pulse-trust-fixes-spec.md, PR-1.
//
// Four checks, fail-closed. A check that could not be read leaves level 4 not granted and says why; "couldn't read" is never a pass.
//  a. Owner agrees: ownerOf(tokenId) on the Normies contract and the official API's /normie/{id}/owner are both readable and name
//     the same non-zero address.
//  b. Owner held at least OWNER_TENURE_DAYS, from normie_index.owner_since. If the live on-chain owner differs from the indexed
//     owner the Normie was just transferred: owner_since belongs to the previous owner and is not used.
//  c. Canvas delegate: a DISPLAY check. A delegate set by a previous owner is reported (canvas_delegate_stale) but does not block
//     level 4 on its own, because the canvas contract already ignores it. Canvas info that can't be read does block.
//  d. The delegate.xyz read completed. Having delegations is fine; only an incomplete read blocks.

import { delegationCheckIncomplete, type DelegateXyzResult } from "@/lib/delegations"

/** Days the current owner must have held the Normie. Tune it here, nowhere else. */
export const OWNER_TENURE_DAYS = 30

const DAY_MS = 86_400_000
const ZERO = "0x0000000000000000000000000000000000000000"
const ADDRESS = /^0x[a-fA-F0-9]{40}$/

export const OWNERSHIP_REASONS = [
  "owner_mismatch",
  "owner_unreadable",
  "tenure_short",
  "tenure_unknown",
  "canvas_delegate_stale",
  "canvas_unreadable",
  "delegations_unreadable",
] as const
export type OwnershipReason = (typeof OWNERSHIP_REASONS)[number]

/** Reported, but never enough on its own to withhold level 4. */
export const DISPLAY_ONLY_REASONS: readonly OwnershipReason[] = ["canvas_delegate_stale"]

/** "Couldn't read" reasons: the answer is unknown, not a finding. A result holding one must not be cached. */
export const UNREADABLE_REASONS: readonly OwnershipReason[] = [
  "owner_unreadable",
  "tenure_unknown",
  "canvas_unreadable",
  "delegations_unreadable",
]

/** Added to the Pulse response as `ownership_check` (additive; nothing else is renamed or removed). */
export type OwnershipCheck = {
  /** True when level 4 is granted. A display-only reason (canvas_delegate_stale) can sit next to passed: true. */
  passed: boolean
  reasons: OwnershipReason[]
  /** When the current owner took the Normie (from the owner index). Null when unknown or when the index still names a previous owner. */
  owner_since: string | null
  tenure_days_required: number
  /** True: no canvas delegate, or the current owner set it. False: a previous owner set it (not honored on-chain). Null: couldn't tell. */
  canvas_delegate_set_by_owner: boolean | null
  delegate_xyz: {
    /** True only when both delegate.xyz registries and every vault they named were read. */
    checked: boolean
    /** Normies this owner wallet controls for other wallets through delegate.xyz. Null when the read did not complete. */
    delegations_found: number | null
  }
  as_of: string
}

/** One read: either a value, or "couldn't read". Never a guessed value. */
export type Readable<T> = { ok: true; value: T } | { ok: false }

export type OwnershipInputs = {
  now: Date
  /** ownerOf(tokenId) on the Normies contract. */
  chainOwner: Readable<string>
  /** `owner` from the official API's /normie/{id}/owner. */
  apiOwner: Readable<string | null | undefined>
  /** The normie_index row: `owner` and `owner_since`. value null = the row is missing. */
  index: Readable<{ owner: string | null; owner_since: string | null } | null>
  /** `delegate` and `delegateSetBy` from the official API's /normie/{id}/canvas/info. */
  canvas: Readable<{ delegate?: string | null; delegateSetBy?: string | null } | null>
  /** findDelegateXyz(owner, …) for the live owner. Null when it was not run (no readable owner) or it threw. */
  delegateXyz: DelegateXyzResult | null
}

const isAddress = (a: unknown): a is string => typeof a === "string" && ADDRESS.test(a)
const isRealAddress = (a: unknown): a is string => isAddress(a) && a.toLowerCase() !== ZERO
const isEmptyAddress = (a: unknown): boolean => a === null || a === undefined || a === "" || (isAddress(a) && a.toLowerCase() === ZERO)
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

export function evaluateOwnershipCheck(i: OwnershipInputs): OwnershipCheck {
  const reasons = new Set<OwnershipReason>()

  // a. Owner agrees. The chain is the reference for the checks below; the API has to agree with it.
  const chainOwner = i.chainOwner.ok && isRealAddress(i.chainOwner.value) ? i.chainOwner.value : null
  const apiOwner = i.apiOwner.ok && isRealAddress(i.apiOwner.value) ? i.apiOwner.value : null
  if (!chainOwner || !apiOwner) reasons.add("owner_unreadable")
  else if (!same(chainOwner, apiOwner)) reasons.add("owner_mismatch")

  // b. Tenure. Needs the live owner: without it there is nothing to compare the index against, and (a) already withholds level 4.
  let ownerSince: string | null = null
  if (chainOwner) {
    if (!i.index.ok) {
      reasons.add("tenure_unknown")
    } else {
      const row = i.index.value
      const indexedOwner = row && isRealAddress(row.owner) ? row.owner : null
      if (!row) {
        reasons.add("tenure_unknown")
      } else if (!indexedOwner || !same(indexedOwner, chainOwner)) {
        // Just transferred: the index still names someone else, so its owner_since is the previous owner's.
        reasons.add("tenure_short")
      } else {
        const since = row.owner_since ? Date.parse(row.owner_since) : Number.NaN
        if (!Number.isFinite(since)) {
          reasons.add("tenure_unknown")
        } else {
          ownerSince = new Date(since).toISOString()
          if (i.now.getTime() - since < OWNER_TENURE_DAYS * DAY_MS) reasons.add("tenure_short")
        }
      }
    }
  }

  // c. Canvas delegate (display check; only an unreadable canvas blocks).
  let delegateSetByOwner: boolean | null = null
  if (!i.canvas.ok || !i.canvas.value) {
    reasons.add("canvas_unreadable")
  } else {
    const { delegate, delegateSetBy } = i.canvas.value
    if (isEmptyAddress(delegate)) {
      delegateSetByOwner = true
    } else if (!isRealAddress(delegate) || !isRealAddress(delegateSetBy)) {
      // A delegate is set but who set it can't be told: unknown, not clean.
      reasons.add("canvas_unreadable")
    } else if (chainOwner) {
      delegateSetByOwner = same(delegateSetBy, chainOwner)
      if (!delegateSetByOwner) reasons.add("canvas_delegate_stale")
    }
  }

  // d. delegate.xyz read completed. Not run without a readable owner; (a) already says why.
  const dxComplete = !!i.delegateXyz && !delegationCheckIncomplete(i.delegateXyz)
  if (chainOwner && !dxComplete) reasons.add("delegations_unreadable")

  const ordered = OWNERSHIP_REASONS.filter((r) => reasons.has(r))
  return {
    passed: ordered.every((r) => DISPLAY_ONLY_REASONS.includes(r)),
    reasons: ordered,
    owner_since: ownerSince,
    tenure_days_required: OWNER_TENURE_DAYS,
    canvas_delegate_set_by_owner: delegateSetByOwner,
    delegate_xyz: { checked: dxComplete, delegations_found: dxComplete && i.delegateXyz ? i.delegateXyz.entries.length : null },
    as_of: i.now.toISOString(),
  }
}

/** True when any part of the check could not be read. Such a result must not be cached. */
export function ownershipCheckUnreadable(check: Pick<OwnershipCheck, "reasons">): boolean {
  return check.reasons.some((r) => UNREADABLE_REASONS.includes(r))
}

/** 0x1234…abcd. Addresses are never typed out in full in UI copy. */
export function shortAddress(address: string): string {
  return ADDRESS.test(address) ? `${address.slice(0, 6)}…${address.slice(-4)}` : "unknown address"
}

/** Plain words for each reason code, for any surface that shows the check. */
export const OWNERSHIP_REASON_TEXT: Record<OwnershipReason, string> = {
  owner_mismatch: "The Normies API and the chain name different owners",
  owner_unreadable: "Couldn't read the current owner",
  tenure_short: `Owner has held it for less than ${OWNER_TENURE_DAYS} days`,
  tenure_unknown: "Couldn't read how long the owner has held it",
  canvas_delegate_stale: "Delegate from a previous owner, not honored",
  canvas_unreadable: "Couldn't read the Canvas delegate",
  delegations_unreadable: "Couldn't finish the delegate.xyz check",
}

/** The check as short plain lines. Pass `delegateSetBy` (from canvas info) to name who set a stale delegate, shortened. */
export function ownershipCheckLines(check: OwnershipCheck, opts: { delegateSetBy?: string | null } = {}): string[] {
  const lines = check.reasons.map((r) =>
    r === "canvas_delegate_stale" && opts.delegateSetBy && ADDRESS.test(opts.delegateSetBy)
      ? `${OWNERSHIP_REASON_TEXT[r]} (set by ${shortAddress(opts.delegateSetBy)})`
      : OWNERSHIP_REASON_TEXT[r],
  )
  if (check.passed) lines.unshift(`Owner confirmed on-chain and held for at least ${check.tenure_days_required} days`)
  return lines
}
