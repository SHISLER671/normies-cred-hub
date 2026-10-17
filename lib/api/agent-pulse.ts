import { ERC8004, IDENTITY_REGISTRY_READ_ABI, NORMIES_API_BASE } from "@/constants/contracts"
import { getChatRatings, type ChatRatingsSummary } from "@/lib/chat-ratings/load"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"
import { getTokenUsageSignal } from "@/lib/instrumentation/pulse-paths"
import type { AgentInfo, CanvasDiff, CanvasInfo, NormieOwner } from "@/lib/types"
import { publicClient } from "@/lib/viem-client"

export const MAX_LEVEL = 5

export const USAGE_BREAKDOWN_SIGNAL =
  "Recent agent usage / interaction signal"

export const NOTE =
  "This Pulse uses Normies API signals plus recent agent usage. Level 5 (Luminous) is earned from Pulse/Paths interaction history."

export const NEXT_SIGNAL =
  "Earn Luminous with recent Pulse checks and Pulse-conditioned Paths activity."

const STATUS_BY_LEVEL: Record<number, string> = {
  0: "Dormant",
  1: "Emerging",
  2: "Building",
  3: "Solid",
  4: "Strong",
  5: "Luminous",
}

export type AgentPulseResponse = {
  token_id: number
  agent_id: number | null
  pulse_level: number
  max_level: number
  status: string
  breakdown: string[]
  next_signal: string | null
  note: string
  /**
   * Hive chat ratings from the ERC-8004 Reputation Registry, ranked signal-over-noise.
   * Informational only — it never changes pulse_level (a fun chat is not a trust signal).
   * Present on the public Pulse endpoints; omitted when the caller didn't ask for it or the agent isn't awakened.
   */
  chat_ratings?: ChatRatingsSummary | null
}

export type AgentPulseResult =
  | { ok: true; data: AgentPulseResponse }
  | { ok: false; error: string; status: 400 | 404 }

async function fetchNormies<T>(path: string): Promise<T | null> {
  try {
    const res = await fetchWithTimeout(
      `${NORMIES_API_BASE}${path}`,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 300 },
      },
      8_000,
    )
    if (!res.ok) return null
    return res.json() as Promise<T>
  } catch {
    return null
  }
}

function isZeroAddr(addr?: string | null): boolean {
  return !addr || addr === "0x0000000000000000000000000000000000000000"
}

function isValidAddr(addr?: string | null): boolean {
  return !!addr && /^0x[a-fA-F0-9]{40}$/.test(addr) && !isZeroAddr(addr)
}

async function isErc8004Registered(agentId: number): Promise<boolean> {
  const registry = ERC8004.IDENTITY_REGISTRY as `0x${string}`
  const args = [BigInt(agentId)] as const

  const [agentURIResult, ownerResult] = await Promise.allSettled([
    publicClient.readContract({
      address: registry,
      abi: IDENTITY_REGISTRY_READ_ABI,
      functionName: "agentURI",
      args,
    }),
    publicClient.readContract({
      address: registry,
      abi: IDENTITY_REGISTRY_READ_ABI,
      functionName: "ownerOf",
      args,
    }),
  ])

  const agentURI =
    agentURIResult.status === "fulfilled" ? (agentURIResult.value as string) : null
  const registeredOwner =
    ownerResult.status === "fulfilled" ? (ownerResult.value as string) : null

  return !!(agentURI || registeredOwner)
}

export function parseTokenId(value: unknown): number | null {
  const tokenId =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN

  if (!Number.isFinite(tokenId) || tokenId < 0 || tokenId > 9999) {
    return null
  }

  return tokenId
}

export type AgentPulseOptions = {
  /** Also read Hive chat ratings (adds a capped, cached on-chain read). Off by default so ranking stays fast. */
  chatRatings?: boolean
}

export async function getAgentPulse(
  tokenId: number,
  options: AgentPulseOptions = {},
): Promise<AgentPulseResult> {
  const [agent, owner, canvas, canvasDiff] = await Promise.all([
    fetchNormies<AgentInfo>(`/agents/info/${tokenId}`),
    fetchNormies<NormieOwner>(`/normie/${tokenId}/owner`),
    fetchNormies<CanvasInfo>(`/normie/${tokenId}/canvas/info`),
    fetchNormies<CanvasDiff>(`/normie/${tokenId}/canvas/diff`),
  ])

  if (!owner) {
    return { ok: false, error: "Token not found", status: 404 }
  }

  const agentId = agent?.agentId ? Number.parseInt(String(agent.agentId), 10) : null
  const breakdown: string[] = []

  if (agentId && Number.isFinite(agentId) && (await isErc8004Registered(agentId))) {
    breakdown.push("ERC-8004 registered")
  }

  const hasActiveAgentCard = !!(
    agent?.agentId &&
    agent.name &&
    (agent.tagline || agent.systemPrompt || agent.greeting)
  )
  if (hasActiveAgentCard) {
    breakdown.push("Has active agent card")
  }

  const hasCanvasActivity = !!(
    canvas &&
    (canvas.customized ||
      canvas.level > 0 ||
      canvas.actionPoints > 0 ||
      (canvasDiff?.addedCount ?? 0) > 0 ||
      (canvasDiff?.removedCount ?? 0) > 0)
  )
  if (hasCanvasActivity) {
    breakdown.push("Canvas activity detected")
  }

  const hasCleanOwnership =
    isValidAddr(owner.owner) &&
    (isZeroAddr(canvas?.delegate) || isValidAddr(canvas?.delegate))
  if (hasCleanOwnership) {
    breakdown.push("Clean ownership & delegation")
  }

  let usageEarned = false
  try {
    const usage = await getTokenUsageSignal(tokenId)
    usageEarned = usage.earned
  } catch {
    usageEarned = false
  }

  const assembled = assemblePulseSignals(breakdown, usageEarned)

  const chatRatings =
    options.chatRatings && agentId && Number.isFinite(agentId) && agentId > 0
      ? await getChatRatings(agentId).catch(() => null)
      : undefined

  return {
    ok: true,
    data: {
      token_id: tokenId,
      agent_id: agentId,
      max_level: MAX_LEVEL,
      ...assembled,
      ...(chatRatings !== undefined ? { chat_ratings: chatRatings } : {}),
    },
  }
}

/** Apply optional 5th usage signal. Fail-open callers pass earned=false. */
export function assemblePulseSignals(
  staticBreakdown: string[],
  usageEarned: boolean,
): Pick<
  AgentPulseResponse,
  "breakdown" | "pulse_level" | "status" | "next_signal" | "note"
> {
  const breakdown = [...staticBreakdown]
  if (usageEarned && !breakdown.includes(USAGE_BREAKDOWN_SIGNAL)) {
    breakdown.push(USAGE_BREAKDOWN_SIGNAL)
  }
  const pulse_level = Math.min(MAX_LEVEL, breakdown.length)
  return {
    breakdown,
    pulse_level,
    status: STATUS_BY_LEVEL[pulse_level] ?? "Dormant",
    next_signal: pulse_level >= MAX_LEVEL ? null : NEXT_SIGNAL,
    note: NOTE,
  }
}