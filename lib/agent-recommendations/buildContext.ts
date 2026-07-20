// lib/agent-recommendations/buildContext.ts
// Builds recommendation context with Normies API enrichment + graceful fallbacks.

import { NORMIES_API_BASE } from "@/constants/contracts"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"
import { isAddress } from "viem"

import { MAX_SESSION_HISTORY, ZULO_IDENTITY } from "./constants"
import type { ZuloRecommendationContext } from "./types"

type BuildContextParams = {
  normieId?: number
  sessionHistory?: Array<{ userMessage: string; zuloResponse: string }>
  userWallet?: string
  userEns?: string
}

type TraitsPayload = {
  attributes?: Array<{ trait_type?: string; value?: string | number }>
}

type AgentInfoPayload = {
  tokenId?: string | number
  agentId?: string | number
  name?: string
  type?: string
  tagline?: string
  backstory?: string
  personalityTraits?: string[]
  communicationStyle?: string
  traits?: {
    name?: string
    attributes?: Record<string, string>
  }
  canvas?: {
    level?: number
    actionPoints?: number
    customized?: boolean
  }
}

type CanvasInfoPayload = {
  actionPoints?: number
  level?: number
  customized?: boolean
  delegate?: string
}

type OwnerPayload = {
  tokenId?: string
  owner?: string
}

type BindingPayload = {
  agentId?: string | number
  tokenId?: string | number
}

type HoldersPayload = {
  address?: string
  tokenIds?: Array<number | string>
}

type HistoryStatsPayload = {
  totalBurns?: number
  totalEdits?: number
  totalCustomized?: number
  [key: string]: unknown
}

async function fetchJsonSafe<T>(path: string, timeoutMs = 8_000): Promise<T | null> {
  try {
    const res = await fetchWithTimeout(`${NORMIES_API_BASE}${path}`, {}, timeoutMs)
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

function traitsToRecord(traits: TraitsPayload | null): Record<string, string | number> {
  const out: Record<string, string | number> = {}
  if (!traits?.attributes) return out
  for (const attr of traits.attributes) {
    if (!attr.trait_type || attr.value === undefined || attr.value === null) continue
    out[attr.trait_type] = attr.value
  }
  return out
}

function parseTokenIds(raw: Array<number | string> | undefined): number[] {
  if (!raw?.length) return []
  const ids: number[] = []
  for (const item of raw) {
    const n = typeof item === "number" ? item : Number(item)
    if (Number.isFinite(n) && n >= 0) ids.push(n)
  }
  return ids.slice(0, 40)
}

function mapSessionHistory(
  history: Array<{ userMessage: string; zuloResponse: string }> | undefined,
): ZuloRecommendationContext["session"]["history"] {
  const now = new Date().toISOString()
  return (history ?? [])
    .slice(-MAX_SESSION_HISTORY)
    .map((h) => ({
      userMessage: h.userMessage,
      zuloResponse: h.zuloResponse,
      timestamp: now,
    }))
}

export async function buildZuloContext(
  params: BuildContextParams,
): Promise<ZuloRecommendationContext> {
  const now = new Date().toISOString()
  const tokenId =
    typeof params.normieId === "number" && Number.isFinite(params.normieId)
      ? params.normieId
      : ZULO_IDENTITY.tokenId

  const wallet =
    params.userWallet && isAddress(params.userWallet) ? params.userWallet : ""

  const [agentInfo, traits, canvasInfo, owner, binding, holders, historyStats] =
    await Promise.all([
      fetchJsonSafe<AgentInfoPayload>(`/agents/info/${tokenId}`),
      fetchJsonSafe<TraitsPayload>(`/normie/${tokenId}/traits`),
      fetchJsonSafe<CanvasInfoPayload>(`/normie/${tokenId}/canvas/info`),
      fetchJsonSafe<OwnerPayload>(`/normie/${tokenId}/owner`),
      fetchJsonSafe<BindingPayload>(`/agents/binding/${tokenId}`),
      wallet
        ? fetchJsonSafe<HoldersPayload>(`/holders/${wallet}`)
        : Promise.resolve(null),
      fetchJsonSafe<HistoryStatsPayload>(`/history/stats`),
    ])

  const traitRecord = {
    ...traitsToRecord(traits),
    ...(agentInfo?.traits?.attributes ?? {}),
  }

  const agentIdRaw = agentInfo?.agentId ?? binding?.agentId
  const agentIdNum =
    agentIdRaw !== undefined && agentIdRaw !== null && String(agentIdRaw).trim() !== ""
      ? Number(agentIdRaw)
      : tokenId === ZULO_IDENTITY.tokenId
        ? ZULO_IDENTITY.agentId
        : 0

  const isAwakened = !!(agentInfo?.agentId || binding?.agentId)

  const ownerAddress =
    owner?.owner && isAddress(owner.owner) ? owner.owner : undefined
  const ownerMatchesUser =
    !!wallet && !!ownerAddress && wallet.toLowerCase() === ownerAddress.toLowerCase()

  const canvasLevel = canvasInfo?.level ?? agentInfo?.canvas?.level
  const canvasAp = canvasInfo?.actionPoints ?? agentInfo?.canvas?.actionPoints
  const canvasCustomized = canvasInfo?.customized ?? agentInfo?.canvas?.customized

  const holdingIds = parseTokenIds(holders?.tokenIds)

  let marketTrends =
    "Normies ecosystem active — Canvas edits, burns, and agent awakenings continue on-chain."
  if (historyStats) {
    const parts: string[] = []
    if (typeof historyStats.totalBurns === "number") {
      parts.push(`burns tracked: ${historyStats.totalBurns}`)
    }
    if (typeof historyStats.totalEdits === "number") {
      parts.push(`canvas edits: ${historyStats.totalEdits}`)
    }
    if (typeof historyStats.totalCustomized === "number") {
      parts.push(`customized: ${historyStats.totalCustomized}`)
    }
    if (parts.length) {
      marketTrends = `Normies activity snapshot — ${parts.join(", ")}.`
    }
  }

  const isZuloDefault = tokenId === ZULO_IDENTITY.tokenId

  const context: ZuloRecommendationContext = {
    user: {
      ens: params.userEns?.trim() || undefined,
      walletAddress: wallet,
      preferences: {
        riskTolerance: "medium",
        goals: ["earn value", "grow collection", "agent utility"],
        interests: ["music", "art", "web3"],
      },
      holdings: wallet
        ? {
            normieCount: holdingIds.length,
            tokenIds: holdingIds,
          }
        : undefined,
    },
    normie: {
      id: tokenId,
      name:
        agentInfo?.name ||
        agentInfo?.traits?.name ||
        (isZuloDefault ? `Normie #${ZULO_IDENTITY.tokenId}` : `Normie #${tokenId}`),
      traits: traitRecord,
      owner: ownerAddress,
      ownerMatchesUser,
      canvas:
        canvasLevel !== undefined || canvasAp !== undefined
          ? {
              level: canvasLevel ?? 0,
              actionPoints: canvasAp ?? 0,
              customized: !!canvasCustomized,
              delegate: canvasInfo?.delegate,
            }
          : isZuloDefault
            ? {
                level: 1,
                actionPoints: 0,
                customized: false,
              }
            : undefined,
      agent: {
        id: Number.isFinite(agentIdNum) && agentIdNum > 0 ? agentIdNum : ZULO_IDENTITY.agentId,
        name:
          agentInfo?.name ||
          (isZuloDefault ? ZULO_IDENTITY.name : `Agent for #${tokenId}`),
        status: isAwakened || isZuloDefault ? "awakened" : "dormant",
        reputation: isZuloDefault ? 75 : undefined,
        walletAddress: isZuloDefault ? ZULO_IDENTITY.hotWallet : undefined,
        ens: isZuloDefault ? ZULO_IDENTITY.ens : undefined,
        type: agentInfo?.type,
        tagline: agentInfo?.tagline,
        backstory: agentInfo?.backstory,
        personalityTraits: agentInfo?.personalityTraits,
        communicationStyle: agentInfo?.communicationStyle,
        recentActivity: [],
      },
    },
    session: {
      history: mapSessionHistory(params.sessionHistory),
      currentGoal: "maximize agent and Normie value",
    },
    platformContext: {
      currentTime: now,
      recentMarketTrends: marketTrends,
    },
  }

  return context
}
