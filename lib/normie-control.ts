import type { NormieSnapshot } from "@/lib/types"

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

export function isZeroAddress(address?: string | null): boolean {
  return !address || address.toLowerCase() === ZERO_ADDRESS
}

export function addressesEqual(
  a?: string | null,
  b?: string | null,
): boolean {
  if (!a || !b) return false
  return a.toLowerCase() === b.toLowerCase()
}

/** Connected wallet is the indexed NFT owner. */
export function isNormieOwner(
  wallet?: string | null,
  ownerAddress?: string | null,
): boolean {
  return !!wallet && !!ownerAddress && addressesEqual(wallet, ownerAddress)
}

/** Connected wallet is the Normies Canvas hot-wallet delegate. */
export function isCanvasDelegate(
  wallet?: string | null,
  delegateAddress?: string | null,
): boolean {
  return (
    !!wallet &&
    !!delegateAddress &&
    !isZeroAddress(delegateAddress) &&
    addressesEqual(wallet, delegateAddress)
  )
}

/** Owner or Canvas delegate — same feature access for both. */
export function controlsNormie(
  wallet?: string | null,
  ownerAddress?: string | null,
  delegateAddress?: string | null,
): boolean {
  return isNormieOwner(wallet, ownerAddress) || isCanvasDelegate(wallet, delegateAddress)
}

/** Whether a Normie has an on-chain ERC-8004 agent registration. */
export function isNormieAwakened(
  agent?: { agentId?: string | number | null } | null,
  binding?: { agentId?: string | number | null } | null,
): boolean {
  const agentId = getResolvedAgentId(agent, binding)
  return agentId != null
}

export function getResolvedAgentId(
  agent?: { agentId?: string | number | null } | null,
  binding?: { agentId?: string | number | null } | null,
): string | number | undefined {
  const agentId = agent?.agentId ?? binding?.agentId
  if (agentId == null || agentId === "" || agentId === 0) return undefined
  return agentId
}

export function isAwakenedFromSnapshot(snapshot?: NormieSnapshot | null): boolean {
  if (!snapshot) return false
  return isNormieAwakened(snapshot.agent, snapshot.binding)
}

export function getSnapshotDelegate(snapshot?: NormieSnapshot | null): string | undefined {
  const delegate = snapshot?.canvas?.delegate
  return delegate && !isZeroAddress(delegate) ? delegate : undefined
}