import { ERC8004, IDENTITY_REGISTRY_READ_ABI, NORMIES_API_BASE } from "@/constants/contracts"
import { getChatRatings, type ChatRatingsSummary } from "@/lib/chat-ratings/load"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"
import { getTokenUsageSignal } from "@/lib/instrumentation/pulse-paths"
import type { AgentInfo, CanvasDiff, CanvasInfo, NormieOwner } from "@/lib/types"
import { publicClient } from "@/lib/viem-client"

/**
 * Pulse levels 1–4 are trust: one per trust check. Level 5 ("Luminous") is popularity ON TOP of trust (Ryan,
 * 2026-10-19: "you can be real and do good but popular is popular"). It needs all four trust checks first, so
 * popularity can never stand in for a missing trust check (before 2026-10-19 a 3-check agent reached 4 with usage).
 * The raw counts ship as `popularity` next to the level, so a botted Luminous is visible to anyone checking.
 */
export const MAX_LEVEL = 5

/** The four trust checks, in the order they are tested. lib/pulse/beats.ts must match these strings exactly. */
export const TRUST_SIGNALS = [
  "ERC-8004 registered",
  "Has active agent card",
  "Canvas activity detected",
  "Clean ownership & delegation",
] as const

/** Level 5 marker in the breakdown. Only present when all four trust checks pass AND the agent is popular. */
export const USAGE_BREAKDOWN_SIGNAL = "Recent agent usage / interaction signal"

export const NOTE =
  "Levels 1–4 are trust: ERC-8004 registration, an active agent card, Canvas activity and clean ownership & delegation. Level 5 (Luminous) is popularity on top of all four: enough different people checked this agent recently. The raw popularity counts are shown so anyone can check them."

export const NEXT_SIGNAL_LUMINOUS =
  "All four trust checks pass. Luminous (level 5) comes from popularity: more different people checking its Pulse or using it in Paths within 14 days."

const STATUS_BY_LEVEL: Record<number, string> = {
  0: "Dormant",
  1: "Emerging",
  2: "Building",
  3: "Solid",
  4: "Strong",
  5: "Luminous",
}

/** Raw usage counts shown next to Pulse. Distinct callers, never raw calls. */
export type PulsePopularity = {
  /** Distinct callers who ran a Pulse check on this Normie in the window. */
  pulse_checkers: number
  /** Distinct callers who ran Paths with this Normie's Pulse in the window. */
  paths_users: number
  lookback_days: number
  /** Popularity threshold met. Raises the level to Luminous only when all four trust checks pass. */
  popular: boolean
  note: string
}

export const POPULARITY_NOTE =
  "Distinct callers, not raw calls. Popularity alone never raises trust: it only lifts an agent that already passes all four trust checks to Luminous."

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
  /** Raw usage counts behind Luminous. Null when the counters couldn't be read (not the same as zero). */
  popularity?: PulsePopularity | null
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

/** Registration rarely changes: keep a successful on-chain answer for 5 minutes per server instance. */
const REGISTRATION_TTL_MS = 5 * 60_000
const registrationCache = new Map<number, { at: number; registered: boolean }>()

async function isErc8004Registered(agentId: number): Promise<boolean> {
  const hit = registrationCache.get(agentId)
  if (hit && Date.now() - hit.at < REGISTRATION_TTL_MS) return hit.registered
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

  const registered = !!(agentURI || registeredOwner)
  // Cache only a real answer: when both reads failed, "not registered" may just mean "couldn't read".
  if (agentURIResult.status === "fulfilled" || ownerResult.status === "fulfilled") {
    if (registrationCache.size > 5_000) registrationCache.clear()
    registrationCache.set(agentId, { at: Date.now(), registered })
  }
  return registered
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

  let popularity: PulsePopularity | null = null
  try {
    const usage = await getTokenUsageSignal(tokenId)
    if (usage.readable) {
      popularity = {
        pulse_checkers: usage.pulseCalls,
        paths_users: usage.conditionedPaths,
        lookback_days: usage.lookbackDays,
        popular: usage.earned,
        note: POPULARITY_NOTE,
      }
    }
  } catch {
    popularity = null
  }

  // Unreadable counters fail closed: no Luminous, but the trust level still stands.
  const assembled = assemblePulseSignals(breakdown, popularity?.popular ?? false)

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
      popularity,
      ...(chatRatings !== undefined ? { chat_ratings: chatRatings } : {}),
    },
  }
}

/**
 * Level = trust checks passed (0–4), plus 1 (Luminous) when all four pass AND the agent is popular.
 * next_signal names the trust checks still missing, in test order; at 4 it points to Luminous; null at 5.
 */
export function assemblePulseSignals(
  staticBreakdown: string[],
  popular: boolean,
): Pick<
  AgentPulseResponse,
  "breakdown" | "pulse_level" | "status" | "next_signal" | "note"
> {
  const have = new Set(staticBreakdown)
  const breakdown: string[] = TRUST_SIGNALS.filter((sig) => have.has(sig))
  const missing = TRUST_SIGNALS.filter((sig) => !have.has(sig))
  const luminous = missing.length === 0 && popular
  if (luminous) breakdown.push(USAGE_BREAKDOWN_SIGNAL)
  const pulse_level = Math.min(MAX_LEVEL, breakdown.length)
  return {
    breakdown,
    pulse_level,
    status: STATUS_BY_LEVEL[pulse_level] ?? "Dormant",
    next_signal: luminous ? null : missing.length === 0 ? NEXT_SIGNAL_LUMINOUS : `Still missing: ${missing.join(", ")}.`,
    note: NOTE,
  }
}
