import { describeToolAccess } from "@opensea/tool-sdk"
import type { Erc8257Chain, RegistryToolAccess } from "@/lib/erc8257/types"
import { ERC8257_CHAIN_CONFIG } from "@/lib/erc8257/constants"

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

export type ResolveToolAccessOptions = {
  /** Skip per-tool describeToolAccess RPC during bulk discovery. */
  skipOnchainDescribe?: boolean
}

export async function resolveToolAccess(
  chain: Erc8257Chain,
  toolId: bigint,
  accessPredicate: string,
  manifestAccessLabels: string[],
  manifestDeclaresGating: boolean,
  options: ResolveToolAccessOptions = {},
): Promise<RegistryToolAccess> {
  const predicateLower = accessPredicate.toLowerCase()
  const openAccess = predicateLower === ZERO_ADDRESS

  let predicateName: string | null = null
  let logic: "AND" | "OR" = "AND"
  let requirementLabels: string[] = []

  if (!openAccess && !options.skipOnchainDescribe) {
    try {
      const { chain: viemChain, rpcUrl } = ERC8257_CHAIN_CONFIG[chain]
      // tool-sdk bundles viem@2.31; project uses viem@2.52 — chain types differ at compile time.
      const described = await describeToolAccess({
        toolId,
        chain: viemChain as never,
        rpcUrl,
      })
      predicateName = described.predicateName
      logic = described.logic
      requirementLabels = described.requirements
        .map((r) => r.label)
        .filter(Boolean)
    } catch {
      requirementLabels = []
    }
  } else if (!openAccess && manifestAccessLabels.length > 0) {
    requirementLabels = manifestAccessLabels
  }

  const manifestAccessMismatch =
    manifestDeclaresGating && openAccess

  const accessNote = buildAccessNote({
    openAccess,
    predicateName,
    requirementLabels,
    manifestAccessLabels,
    manifestAccessMismatch,
  })

  return {
    openAccess,
    predicateAddress: openAccess ? null : accessPredicate,
    predicateName,
    logic,
    requirementLabels,
    accessNote,
    manifestAccessMismatch,
  }
}

function buildAccessNote(opts: {
  openAccess: boolean
  predicateName: string | null
  requirementLabels: string[]
  manifestAccessLabels: string[]
  manifestAccessMismatch: boolean
}): string {
  const parts: string[] = []

  if (opts.openAccess) {
    parts.push("Open access — no on-chain gate")
  } else {
    const gate = opts.predicateName ? `Gated (${opts.predicateName})` : "Gated"
    const reqs =
      opts.requirementLabels.length > 0
        ? opts.requirementLabels.join("; ")
        : "see on-chain predicate"
    parts.push(`${gate}: ${reqs}`)
  }

  if (opts.manifestAccessLabels.length > 0) {
    parts.push(`Manifest: ${opts.manifestAccessLabels.join("; ")}`)
  }

  if (opts.manifestAccessMismatch) {
    parts.push(
      "Note: manifest declares gating but registry predicate was not set (may be misconfigured)",
    )
  }

  return parts.join(" · ")
}