import type {
  CredibilitySignal,
  EthosScoreResult,
  NormieSnapshot,
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