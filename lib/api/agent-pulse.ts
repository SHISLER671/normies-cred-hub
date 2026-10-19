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
  "This Pulse uses Normies API signals plus recent agent usage. Level 5 (Luminous) is reached through Pulse/Paths interaction history."

export const NEXT_SIGNAL =
  "Reach Luminous with recent Pulse checks and Pulse-conditioned Paths activity."

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
  | { ok: false; error: string; status: 400 | 404 | 502 }

/** A Normies API read that tells "not found" (404) apart from "couldn't read" (timeout, 5xx, bad JSON). */
type Read<T> = { data: T | null; status: "ok" | "not_found" | "failed" }

async function readNormies<T>(path: string): Promise<Read<T>> {
  try {
    const res = await fetchWithTimeout(
      `${NORMIES_API_BASE}${path}`,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 300 },
      },
      8_000,
    )
    if (res.status === 404) return { data: null, status: "not_found" }
    if (!res.ok) return { data: null, status: "failed" }
    return { data: (await res.json()) as T, status: "ok" }
  } catch {
    return { data: null, status: "failed" }
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

/**
 * A Normie token id (0–9999), or null. Strict: whole numbers only. "7141abc", "1e3", "12.9", 1.5, "" and booleans are
 * refused (parseInt used to turn "7141abc" into 7141 and "1e3" into 1). A leading zero is fine ("07141" → 7141).
 */
export function parseTokenId(value: unknown): number | null {
  let tokenId: number
  if (typeof value === "number") tokenId = value
  else if (typeof value === "string" && /^\d{1,5}$/.test(value.trim())) tokenId = Number(value.trim())
  else return null

  if (!Number.isInteger(tokenId) || tokenId < 0 || tokenId > 9999) {
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
  const [agentRead, ownerRead, canvasRead, diffRead] = await Promise.all([
    readNormies<AgentInfo>(`/agents/info/${tokenId}`),
    readNormies<NormieOwner>(`/normie/${tokenId}/owner`),
    readNormies<CanvasInfo>(`/normie/${tokenId}/canvas/info`),
    readNormies<CanvasDiff>(`/normie/${tokenId}/canvas/diff`),
  ])
  const agent = agentRead.data
  const owner = ownerRead.data
  const canvas = canvasRead.data
  const canvasDiff = diffRead.data

  if (!owner) {
    // An outage is not "this Normie doesn't exist": say which, so callers don't cache a false 404.
    return ownerRead.status === "not_found"
      ? { ok: false, error: "Token not found", status: 404 }
      : { ok: false, error: "The Normies API is unavailable right now. Try again shortly.", status: 502 }
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

  // Only granted when the canvas delegate was actually read: a failed read used to look like "no delegate" (clean).
  const hasCleanOwnership =
    canvasRead.status === "ok" &&
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