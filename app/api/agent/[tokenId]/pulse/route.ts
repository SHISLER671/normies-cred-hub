import { ERC8004, IDENTITY_REGISTRY_READ_ABI, NORMIES_API_BASE } from "@/constants/contracts"
import { publicClient } from "@/lib/viem-client"
import type { AgentInfo, CanvasDiff, CanvasInfo, NormieOwner } from "@/lib/types"
import { type NextRequest, NextResponse } from "next/server"

const MAX_LEVEL = 4

const NOTE =
  "This Pulse uses currently available signals from the Normies API. As more agents transact and interact on-chain, real usage metrics will be added in future updates."

const STATUS_BY_LEVEL: Record<number, string> = {
  0: "Dormant",
  1: "Emerging",
  2: "Building",
  3: "Solid",
  4: "Strong",
}

async function fetchNormies<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${NORMIES_API_BASE}${path}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
    })
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

/**
 * Public Pulse endpoint — agent-readable reputation signal.
 * Calculated on the fly from Normies API + ERC-8004 on-chain reads.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tokenId: string }> },
) {
  const { tokenId: tokenIdStr } = await params
  const tokenId = Number.parseInt(tokenIdStr, 10)

  if (!Number.isFinite(tokenId) || tokenId < 0 || tokenId > 9999) {
    return NextResponse.json({ error: "Invalid token ID (must be 0–9999)" }, { status: 400 })
  }

  const [agent, owner, canvas, canvasDiff] = await Promise.all([
    fetchNormies<AgentInfo>(`/agents/info/${tokenId}`),
    fetchNormies<NormieOwner>(`/normie/${tokenId}/owner`),
    fetchNormies<CanvasInfo>(`/normie/${tokenId}/canvas/info`),
    fetchNormies<CanvasDiff>(`/normie/${tokenId}/canvas/diff`),
  ])

  if (!owner) {
    return NextResponse.json({ error: "Token not found" }, { status: 404 })
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

  const pulse_level = breakdown.length

  return NextResponse.json(
    {
      token_id: tokenId,
      agent_id: agentId,
      pulse_level,
      max_level: MAX_LEVEL,
      status: STATUS_BY_LEVEL[pulse_level] ?? "Dormant",
      breakdown,
      note: NOTE,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    },
  )
}