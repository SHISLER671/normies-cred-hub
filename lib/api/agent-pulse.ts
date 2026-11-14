import { ERC8004, IDENTITY_REGISTRY_READ_ABI, NORMIES_API_BASE } from "@/constants/contracts"
import { getChatRatings, type ChatRatingsSummary } from "@/lib/chat-ratings/load"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"
import { getTokenUsageSignal, type TokenUsageSignal } from "@/lib/instrumentation/pulse-paths"
import type { OwnershipCheck } from "@/lib/ownership-check"
import { loadOwnershipCheck, type OwnershipDeps } from "@/lib/ownership-check-load"
import type { AgentInfo, CanvasDiff, CanvasInfo, NormieOwner } from "@/lib/types"
import { publicClient } from "@/lib/viem-client"

/**
 * Pulse is trust and nothing else: levels 1–4 are the four trust checks, one level per check passed (Ryan, 2026-11-14).
 * Popularity no longer changes the level. Until 2026-11-14 a fifth level ("level 5") was popularity on top of all four
 * checks; it is now a separate "Trending on NCH" badge (`trending`), shown with the raw counts (`popularity`) beside it.
 */
export const MAX_LEVEL = 4

/** Tells outside consumers which scale `pulse_level` is on. The scale before 2026-11-14 ran 0–5 and had no such field. */
export const PULSE_SCALE = "trust-0-4"

/** The popularity badge. Separate from the level: it never raises or lowers `pulse_level`. */
export const TRENDING_LABEL = "Trending on NCH"

/** The four trust checks, in the order they are tested. lib/pulse/beats.ts must match these strings exactly. */
export const TRUST_SIGNALS = [
  "ERC-8004 registered",
  "Has active agent card",
  "Canvas activity detected",
  "Clean ownership & delegation",
] as const

export const NOTE =
  'Levels 1–4 are the four trust checks: ERC-8004 registration, an active agent card, Canvas activity and clean ownership & delegation. Popularity is separate and never changes the level: "Trending on NCH" shows when enough different people checked this agent recently. The raw popularity counts are shown so anyone can check them.'

const STATUS_BY_LEVEL: Record<number, string> = {
  0: "Dormant",
  1: "Emerging",
  2: "Building",
  3: "Solid",
  4: "Strong",
}

/** Raw usage counts shown next to Pulse. Distinct callers, never raw calls. */
export type PulsePopularity = {
  /** Distinct callers who ran a Pulse check on this Normie in the window. */
  pulse_checkers: number
  /** Distinct callers who ran Paths with this Normie's Pulse in the window. */
  paths_users: number
  lookback_days: number
  /** Popularity threshold met. Shown as the "Trending on NCH" badge; never changes the level. */
  popular: boolean
  note: string
}

export const POPULARITY_NOTE =
  'Distinct callers, not raw calls. Popularity never changes the Pulse level: it only decides the "Trending on NCH" badge.'

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
  /** Raw usage counts behind the "Trending on NCH" badge. Null when the counters couldn't be read (not the same as zero). */
  popularity?: PulsePopularity | null
  /** "Trending on NCH": the popularity threshold is met (= popularity.popular). False when the counters couldn't be read. Never changes pulse_level. */
  trending?: boolean
  /** Which scale pulse_level is on. "trust-0-4": levels are the four trust checks only. Absent on the older 0–5 scale. */
  pulse_scale?: typeof PULSE_SCALE
  /**
   * The evidence behind "Clean ownership & delegation" (lib/ownership-check.ts). `passed` is exactly whether that check is in
   * `breakdown`. `reasons` says what failed or couldn't be read; a display-only reason can sit next to passed: true.
   */
  ownership_check?: OwnershipCheck
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
  /** Test seam: the on-chain owner, owner index and delegate.xyz reads behind the ownership check. */
  ownershipDeps?: OwnershipDeps
  /** Test seam: the popularity counters read. */
  readUsage?: (tokenId: number) => Promise<TokenUsageSignal>
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

  // Four checks, fail-closed (lib/ownership-check.ts): a read that fails is reported as a reason, never counted as clean.
  const ownershipCheck = await loadOwnershipCheck(
    tokenId,
    {
      apiOwner: { ok: true, value: owner.owner },
      canvas: canvasRead.status === "ok" ? { ok: true, value: canvas } : { ok: false },
    },
    options.ownershipDeps,
  )
  if (ownershipCheck.passed) {
    breakdown.push("Clean ownership & delegation")
  }

  let popularity: PulsePopularity | null = null
  try {
    const usage = await (options.readUsage ?? getTokenUsageSignal)(tokenId)
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

  // Popularity never touches the level. Unreadable counters fail closed: not trending.
  const assembled = assemblePulseSignals(breakdown)

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
      pulse_scale: PULSE_SCALE,
      ...assembled,
      popularity,
      trending: popularity?.popular ?? false,
      ownership_check: ownershipCheck,
      ...(chatRatings !== undefined ? { chat_ratings: chatRatings } : {}),
    },
  }
}

/**
 * Level = trust checks passed (0–4). Nothing else counts: unknown strings in the input are ignored.
 * next_signal names the trust checks still missing, in test order; null when all four pass.
 */
export function assemblePulseSignals(
  staticBreakdown: string[],
): Pick<
  AgentPulseResponse,
  "breakdown" | "pulse_level" | "status" | "next_signal" | "note"
> {
  const have = new Set(staticBreakdown)
  const breakdown: string[] = TRUST_SIGNALS.filter((sig) => have.has(sig))
  const missing = TRUST_SIGNALS.filter((sig) => !have.has(sig))
  const pulse_level = Math.min(MAX_LEVEL, breakdown.length)
  return {
    breakdown,
    pulse_level,
    status: STATUS_BY_LEVEL[pulse_level] ?? "Dormant",
    next_signal: missing.length === 0 ? null : `Still missing: ${missing.join(", ")}.`,
    note: NOTE,
  }
}
