import type {
  CredibilitySignal,
  EthosScoreResult,
  NormieSnapshot,
  ToolRegistrySignal,
  WireExecutionSignal,
} from "@/lib/types"

/** Ensure a partial signal has consistent defaults before rendering or aggregation. */
export function normalizeSignal(
  signal: Partial<CredibilitySignal> &
    Pick<CredibilitySignal, "id" | "source" | "category" | "title" | "verifiable">
): CredibilitySignal {
  return {
    description: undefined,
    score: undefined,
    weight: undefined,
    metadata: undefined,
    timestamp: undefined,
    ...signal,
  }
}

/** ERC-8004 on-chain identity signal for the Credibility Framework. */
export function buildIdentitySignal(
  snapshot: NormieSnapshot | undefined
): CredibilitySignal {
  return normalizeSignal({
    id: `identity-${snapshot?.tokenId ?? "unknown"}`,
    source: "erc8004",
    category: "identity",
    title: "On-Chain Identity",
    description:
      "This registers your Normie as a verifiable ERC-8004 agent on-chain. It creates a public, immutable record that other systems can reference.",
    verifiable: !!snapshot?.agent?.agentId,
    metadata: snapshot?.agent?.agentId
      ? { agentId: snapshot.agent.agentId, registry: "erc-8004" }
      : undefined,
    timestamp: snapshot?.agent?.registeredAt,
  })
}

/** Ownership & delegation signal for the Credibility Framework. */
export function buildOwnershipSignal(
  snapshot: NormieSnapshot | undefined
): CredibilitySignal {
  return normalizeSignal({
    id: `ownership-${snapshot?.tokenId ?? "unknown"}`,
    source: "erc8004",
    category: "ownership",
    title: "Ownership & Delegation",
    description:
      "Ownership proves control of the NFT. Delegation lets the agent operate while the asset stays secure in cold storage.",
    verifiable: !!snapshot?.owner?.owner,
    metadata: snapshot?.owner
      ? { owner: snapshot.owner.owner, delegate: snapshot.canvas?.delegate }
      : undefined,
  })
}

/** On-chain canvas activity signal for the Credibility Framework. */
export function buildCanvasSignal(
  snapshot: NormieSnapshot | undefined
): CredibilitySignal {
  return normalizeSignal({
    id: `canvas-${snapshot?.tokenId ?? "unknown"}`,
    source: "erc8004",
    category: "identity",
    title: "On-Chain Activity (Canvas)",
    description:
      "Canvas level and pixel changes show ongoing engagement and evolution. Consistent activity signals a living, maintained agent identity.",
    verifiable: !!snapshot?.canvas,
    metadata: snapshot?.canvas
      ? {
          level: snapshot.canvas.level,
          actionPoints: snapshot.canvas.actionPoints,
          customized: snapshot.canvas.customized,
        }
      : undefined,
  })
}

/** Ethos reputation signal for the Credibility Framework. */
export function buildEthosSignal(
  ethos: EthosScoreResult | undefined,
  ownerAddress?: string
): CredibilitySignal {
  return normalizeSignal({
    id: `ethos-${ownerAddress ?? "unknown"}`,
    source: "ethos",
    category: "reputation",
    title: "Reputation (Ethos)",
    description:
      "The Ethos score reflects how the community perceives the owner's on-chain behavior. Higher scores indicate stronger, community-backed credibility.",
    score: ethos?.user?.score,
    verifiable: !!ethos?.found,
    metadata: ethos?.user
      ? { level: ethos.level, username: ethos.user.username }
      : undefined,
  })
}

/** External trust / AgentCheck signal for the Credibility Framework. */
export function buildExternalSignal(
  snapshot: NormieSnapshot | undefined
): CredibilitySignal {
  return normalizeSignal({
    id: `external-${snapshot?.tokenId ?? "unknown"}`,
    source: "erc8004",
    category: "external",
    title: "External Trust Signals",
    description:
      "Community tools like AgentCheck can provide additional verification for your agent.",
    verifiable: false,
    metadata: snapshot ? { tokenId: snapshot.tokenId } : undefined,
  })
}

/** Wire UTL placeholder — no live data yet. */
export function buildWirePlaceholderSignal(
  agentId?: string | number
): CredibilitySignal {
  return normalizeSignal({
    id: `wire-placeholder-${agentId ?? "pending"}`,
    source: "wire",
    category: "execution",
    title: "Cross-Chain Execution (Wire)",
    description:
      "Wire Network UTL provides deterministic, verifiable cross-chain execution history — transaction certainty and reliability signals for autonomous agents.",
    verifiable: false,
    metadata: { status: "coming_soon" },
  })
}

/** ERC-8257 tool-registry placeholder — no live registry yet. */
export function buildToolRegistryPlaceholderSignal(
  agentId?: string | number
): CredibilitySignal {
  return normalizeSignal({
    id: `tool-registry-placeholder-${agentId ?? "pending"}`,
    source: "erc8257",
    category: "tooling",
    title: "Verifiable Tooling (ERC-8257)",
    description:
      "ERC-8257 turns the curated tool list into a permissionless on-chain registry — each tool content-addressed and verifiable, with access gated by predicate contracts (e.g. awakened-agent ownership). Today the list is curated; the framework is schema-ready for the registry.",
    verifiable: false,
    metadata: { status: "coming_soon", standard: "erc-8257", draft: true },
  })
}

/**
 * Returns the ordered list of framework signals for the current agent context.
 * Section content is still rendered in the dashboard; this layer owns metadata.
 */
export function getCurrentSignals(input: {
  snapshot?: NormieSnapshot
  ethos?: EthosScoreResult
  ownerAddress?: string
}): CredibilitySignal[] {
  const { snapshot, ethos, ownerAddress } = input

  return [
    buildIdentitySignal(snapshot),
    buildOwnershipSignal(snapshot),
    buildCanvasSignal(snapshot),
    buildEthosSignal(ethos, ownerAddress),
    buildExternalSignal(snapshot),
    buildWirePlaceholderSignal(snapshot?.agent?.agentId),
    buildToolRegistryPlaceholderSignal(snapshot?.agent?.agentId),
  ]
}

/**
 * Placeholder for Wire Network UTL (Universal Transaction Layer) signals.
 * Not yet wired to a live API — returns an empty list until integration lands.
 *
 * Future signals will focus on verifiable execution history, transaction
 * certainty, and cross-chain reliability rather than traditional reputation.
 */
export async function getWireSignals(
  agentId: string | number
): Promise<CredibilitySignal[]> {
  void agentId

  // Future: map WireExecutionSignal payloads into CredibilitySignal entries, e.g.:
  // - crossChainActionsCount → execution volume
  // - successRate / settlementCertainty → reliability score
  // - lastVerifiedExecution → freshness timestamp

  return []
}

/** Normalize raw Wire execution payload into a structured signal shape. */
export function normalizeWireExecution(
  raw: Partial<WireExecutionSignal> & Pick<WireExecutionSignal, "agentId">
): WireExecutionSignal {
  return {
    crossChainActionsCount: undefined,
    successRate: undefined,
    lastVerifiedExecution: undefined,
    settlementCertainty: undefined,
    totalTransactions: undefined,
    verifiedExecutionHistory: undefined,
    metadata: undefined,
    ...raw,
  }
}

/** Map a Wire execution record into a framework-ready CredibilitySignal. */
export function wireExecutionToSignal(
  execution: WireExecutionSignal
): CredibilitySignal {
  return normalizeSignal({
    id: `wire-execution-${execution.agentId}`,
    source: "wire",
    category: "execution",
    title: "Cross-Chain Execution (Wire)",
    description:
      "Verifiable execution history and settlement certainty from Wire Network UTL.",
    score: execution.settlementCertainty,
    verifiable: true,
    metadata: {
      crossChainActionsCount: execution.crossChainActionsCount,
      successRate: execution.successRate,
      lastVerifiedExecution: execution.lastVerifiedExecution,
      totalTransactions: execution.totalTransactions,
      verifiedExecutionHistory: execution.verifiedExecutionHistory,
      ...execution.metadata,
    },
    timestamp: execution.lastVerifiedExecution,
  })
}

/**
 * Placeholder for ERC-8257 (draft) tool-registry signals.
 * Not yet wired to a live registry — returns an empty list until integration
 * lands. Future signals will reflect on-chain tool discoverability,
 * content-hash integrity, and predicate-gated access for the connected agent.
 */
export async function getToolRegistrySignals(
  agentId: string | number
): Promise<CredibilitySignal[]> {
  void agentId

  // Future: read the ERC-8257 registry and map each registered tool, e.g.:
  // - uri + contentHash → verifiable, content-addressed manifest
  // - gatePredicate → whether this agent satisfies the access gate
  // - registeredAt → freshness timestamp

  return []
}

/** Normalize a raw ERC-8257 registry entry into a structured signal shape. */
export function normalizeToolRegistryEntry(
  raw: Partial<ToolRegistrySignal> & Pick<ToolRegistrySignal, "toolId">
): ToolRegistrySignal {
  return {
    uri: undefined,
    contentHash: undefined,
    gatePredicate: undefined,
    registered: undefined,
    accessGranted: undefined,
    registeredAt: undefined,
    metadata: undefined,
    ...raw,
  }
}

/** Map an ERC-8257 registry entry into a framework-ready CredibilitySignal. */
export function toolRegistryToSignal(
  entry: ToolRegistrySignal
): CredibilitySignal {
  return normalizeSignal({
    id: `tool-registry-${entry.toolId}`,
    source: "erc8257",
    category: "tooling",
    title: "Verifiable Tooling (ERC-8257)",
    description:
      "On-chain, content-addressed tool registration with predicate-gated access.",
    verifiable: !!entry.registered,
    metadata: {
      uri: entry.uri,
      contentHash: entry.contentHash,
      gatePredicate: entry.gatePredicate,
      accessGranted: entry.accessGranted,
      ...entry.metadata,
    },
    timestamp: entry.registeredAt,
  })
}
