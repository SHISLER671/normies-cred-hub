import type {
  AgentInfo,
  CanvasDiff,
  CanvasInfo,
  NormieMetadata,
  NormieOwner,
  NormieSnapshot,
  NormieTraits,
  OwnedNormie,
} from "@/lib/types"
import { ZERO_ADDRESS } from "@/lib/normie-control"

/**
 * Client-side Normies API helpers.
 *
 * All requests go through our own `/api/normies/*` proxy routes (server-side)
 * to avoid browser CORS issues and to centralize caching. These are READ-ONLY.
 */

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`/api/normies${path}`)
  if (!res.ok) {
    throw new Error(`Normies API error (${res.status}) for ${path}`)
  }
  return res.json() as Promise<T>
}

export function normieImageUrl(tokenId: number): string {
  return `https://api.normies.art/normie/${tokenId}/image.svg`
}

export interface HoldersResponse {
  address: string
  tokenIds: Array<number | string>
}

export interface AgentIdentityResponse {
  tokenId: number
  name: string
  type: string
  traits: Record<string, string>
}

export interface BindingBatchResponse {
  bindings: Record<
    string,
    {
      agentId?: string
      tokenId?: string
    }
  >
}

export const normiesApi = {
  traits: (id: number) => getJson<NormieTraits>(`/${id}/traits`),
  metadata: (id: number) => getJson<NormieMetadata>(`/${id}/metadata`),
  owner: (id: number) => getJson<NormieOwner>(`/${id}/owner`),
  canvasInfo: (id: number) => getJson<CanvasInfo>(`/${id}/canvas/info`),
  canvasDiff: (id: number) => getJson<CanvasDiff>(`/${id}/canvas/diff`),
  agentInfo: (id: number) => getJson<AgentInfo>(`/${id}/agent`),
  agentBinding: (id: number) => getJson<any>(`/agents/binding/${id}`),
  agentIdentity: (id: number) => getJson<AgentIdentityResponse>(`/agents/identity/${id}`),
  holders: (address: string) => getJson<HoldersResponse>(`/holders/${address}`),
}

export async function fetchBindingsBatch(
  tokenIds: number[],
): Promise<BindingBatchResponse["bindings"]> {
  if (tokenIds.length === 0) return {}

  const res = await fetch("/api/normies/agents/binding/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tokenIds }),
  })

  if (!res.ok) {
    throw new Error(`Normies batch binding error (${res.status})`)
  }

  const data = (await res.json()) as BindingBatchResponse
  return data.bindings ?? {}
}

/** Enriches token IDs with type and awakened status from the Normies API. */
export async function enrichOwnedNormies(tokenIds: number[]): Promise<OwnedNormie[]> {
  if (tokenIds.length === 0) return []

  const [bindings, identities] = await Promise.all([
    fetchBindingsBatch(tokenIds).catch(() => ({} as BindingBatchResponse["bindings"])),
    Promise.all(
      tokenIds.map(async (id) => {
        try {
          return await normiesApi.agentIdentity(id)
        } catch {
          try {
            const traits = await normiesApi.traits(id)
            const type =
              traits.attributes.find((t) => t.trait_type === "Type")?.value?.toString() ??
              "Unknown"
            return { tokenId: id, name: `Normie #${id}`, type, traits: {} }
          } catch {
            return { tokenId: id, name: `Normie #${id}`, type: "Unknown", traits: {} }
          }
        }
      }),
    ),
  ])

  return tokenIds.map((tokenId) => {
    const identity = identities.find((item) => item.tokenId === tokenId)
    const binding = bindings[String(tokenId)]
    return {
      tokenId,
      type: identity?.type ?? "Unknown",
      isAwakened: !!binding?.agentId,
    }
  })
}

export async function isAgentAwakened(tokenId: number): Promise<boolean> {
  try {
    const binding = await normiesApi.agentBinding(tokenId)
    // Awakened if the binding endpoint returns meaningful data (has agentId or non-empty)
    return !!(binding && (binding.agentId || (typeof binding === 'object' && Object.keys(binding).length > 0)))
  } catch {
    return false
  }
}

function emptyAgentInfo(tokenId: number): AgentInfo {
  return {
    tokenId: String(tokenId),
    agentId: "",
    chainId: 1,
    name: `Normie #${tokenId}`,
    type: "Unknown",
    tagline: "",
    backstory: "",
    greeting: "",
    personalityTraits: [],
    communicationStyle: "",
    quirks: [],
    systemPrompt: "",
  }
}

/** Fetches every public surface for a Normie in parallel. */
export async function fetchNormieSnapshot(tokenId: number): Promise<NormieSnapshot> {
  const results = await Promise.allSettled([
    normiesApi.metadata(tokenId),
    normiesApi.traits(tokenId),
    normiesApi.owner(tokenId),
    normiesApi.canvasInfo(tokenId),
    normiesApi.canvasDiff(tokenId),
    normiesApi.agentInfo(tokenId),
    normiesApi.agentBinding(tokenId),
  ])

  const fulfilled = <T>(index: number, fallback: T): T =>
    results[index]?.status === "fulfilled" ? (results[index] as PromiseFulfilledResult<T>).value : fallback

  const metadata = fulfilled(0, { name: `Normie #${tokenId}`, attributes: [], image: normieImageUrl(tokenId) })
  const traits = fulfilled(1, { raw: "", attributes: [] })
  const owner = fulfilled(2, { tokenId: String(tokenId), owner: "" })
  const canvas = fulfilled(3, {
    actionPoints: 0,
    level: 0,
    customized: false,
    delegate: ZERO_ADDRESS,
    delegateSetBy: ZERO_ADDRESS,
  })
  const canvasDiff = fulfilled(4, {
    added: [],
    removed: [],
    addedCount: 0,
    removedCount: 0,
    netChange: 0,
  })
  const agentRaw = fulfilled(5, null as AgentInfo | null)
  const binding = fulfilled(6, null as { agentId?: string } | null)

  const agent =
    agentRaw && agentRaw.agentId
      ? agentRaw
      : binding?.agentId
        ? { ...emptyAgentInfo(tokenId), ...agentRaw, agentId: binding.agentId }
        : agentRaw ?? emptyAgentInfo(tokenId)

  return {
    tokenId,
    metadata,
    traits,
    owner,
    canvas,
    canvasDiff,
    agent,
    binding,
    imageUrl: normieImageUrl(tokenId),
  }
}
