import { getResolvedAgentId, isNormieAwakened } from "@/lib/normie-control"
import type {
  CredibilitySignal,
  CredibilitySignalCategory,
  EthosScoreResult,
  NormieSnapshot,
  ToolRegistrySignal,
  WireExecutionSignal,
} from "@/lib/types"

const ALLOWED_CATEGORIES: CredibilitySignalCategory[] = [
  "identity",
  "ownership",
  "execution",
  "reputation",
  "external",
]

export type SignalValidationResult = {
  isValid: boolean
  errors: string[]
}

export type InvalidSignalRecord = {
  signal: unknown
  errors: string[]
}

/** Validate a single credibility signal before UI consumption. */
export function validateSignal(signal: unknown): SignalValidationResult {
  const errors: string[] = []

  if (!signal || typeof signal !== "object") {
    return { isValid: false, errors: ["Signal must be a non-null object"] }
  }

  const s = signal as Record<string, unknown>

  if (typeof s.id !== "string" || s.id.trim() === "") {
    errors.push("id is required and must be a non-empty string")
  }

  if (typeof s.source !== "string" || s.source.trim() === "") {
    errors.push("source is required and must be a non-empty string")
  }

  if (
    typeof s.category !== "string" ||
    !ALLOWED_CATEGORIES.includes(s.category as CredibilitySignalCategory)
  ) {
    errors.push(
      `category must be one of: ${ALLOWED_CATEGORIES.join(", ")}`
    )
  }

  if (typeof s.title !== "string" || s.title.trim() === "") {
    errors.push("title is required and must be a non-empty string")
  }

  if (typeof s.verifiable !== "boolean") {
    errors.push("verifiable is required and must be a boolean")
  }

  if (s.score !== undefined && s.score !== null) {
    if (typeof s.score !== "number" || Number.isNaN(s.score)) {
      errors.push("score must be a number when provided")
    } else if (s.score < 0 || s.score > 100) {
      errors.push("score must be between 0 and 100 when provided")
    }
  }

  if (s.weight !== undefined && s.weight !== null) {
    if (typeof s.weight !== "number" || Number.isNaN(s.weight)) {
      errors.push("weight must be a number when provided")
    } else if (s.weight < 0 || s.weight > 1) {
      errors.push("weight must be between 0 and 1 when provided")
    }
  }

  return { isValid: errors.length === 0, errors }
}

/** Batch-validate signals; partition into valid and invalid sets. */
export function validateSignals(signals: unknown[]): {
  validSignals: CredibilitySignal[]
  invalidSignals: InvalidSignalRecord[]
} {
  if (!Array.isArray(signals)) {
    return {
      validSignals: [],
      invalidSignals: [
        { signal: signals, errors: ["Input must be an array of signals"] },
      ],
    }
  }

  const validSignals: CredibilitySignal[] = []
  const invalidSignals: InvalidSignalRecord[] = []

  for (const signal of signals) {
    const result = validateSignal(signal)
    if (result.isValid) {
      validSignals.push(signal as CredibilitySignal)
    } else {
      invalidSignals.push({ signal, errors: result.errors })
    }
  }

  return { validSignals, invalidSignals }
}

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
    verifiable: isNormieAwakened(snapshot?.agent, snapshot?.binding),
    metadata: getResolvedAgentId(snapshot?.agent, snapshot?.binding)
      ? { agentId: getResolvedAgentId(snapshot?.agent, snapshot?.binding), registry: "erc-8004" }
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
    title: "Cross-Chain Execution (Wire Network)",
    description:
      "Prepared for Wire Network integration. Future signals will include verifiable cross-chain execution history and transaction reliability for awakened agents.",
    verifiable: false,
    metadata: { status: "coming_soon" },
  })
}

/** ERC-8257 on-chain tool registry — live on Ethereum + Base. */
export function buildToolRegistryPlaceholderSignal(
  agentId?: string | number
): CredibilitySignal {
  return normalizeSignal({
    id: `tool-registry-live-${agentId ?? "pending"}`,
    source: "erc8257",
    category: "tooling",
    title: "Verifiable Tooling (ERC-8257)",
    description:
      "Live on-chain agent tool registry — content-addressed manifests on Ethereum and Base, with predicate-gated access (NFT ownership, subscriptions, and more). Zulo can discover and recommend these tools.",
    verifiable: true,
    metadata: { status: "live", standard: "erc-8257" },
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
    buildWirePlaceholderSignal(getResolvedAgentId(snapshot?.agent, snapshot?.binding)),
    buildToolRegistryPlaceholderSignal(getResolvedAgentId(snapshot?.agent, snapshot?.binding)),
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
    title: "Cross-Chain Execution (Wire Network)",
    description:
      "Prepared for Wire Network integration. Future signals will include verifiable cross-chain execution history and transaction reliability for awakened agents.",
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
 * Maps cached ERC-8257 registry entries into credibility signals for an agent.
 */
export async function getToolRegistrySignals(
  agentId: string | number
): Promise<CredibilitySignal[]> {
  try {
    const { getCachedRegistryTools } = await import("@/lib/erc8257/cache")
    const { tools } = await getCachedRegistryTools()

    const relevant = tools
      .filter(
        (t) =>
          t.manifestVerified &&
          (t.tags.some((tag) =>
            ["normies", "reputation", "trust", "erc8004"].includes(tag.toLowerCase()),
          ) ||
            t.name.toLowerCase().includes("normie")),
      )
      .slice(0, 8)

    return relevant.map((tool) =>
      toolRegistryToSignal(
        normalizeToolRegistryEntry({
          toolId: String(tool.toolId),
          uri: tool.manifestUri,
          contentHash: tool.manifestHash,
          gatePredicate: tool.access.predicateAddress ?? undefined,
          registered: true,
          metadata: {
            name: tool.name,
            chain: tool.chain,
            accessNote: tool.access.accessNote,
            agentId,
          },
        }),
      ),
    )
  } catch {
    return []
  }
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
