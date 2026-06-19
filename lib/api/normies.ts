import type {
  AgentInfo,
  CanvasDiff,
  CanvasInfo,
  NormieMetadata,
  NormieOwner,
  NormieSnapshot,
  NormieTraits,
} from "@/lib/types"

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

export const normiesApi = {
  traits: (id: number) => getJson<NormieTraits>(`/${id}/traits`),
  metadata: (id: number) => getJson<NormieMetadata>(`/${id}/metadata`),
  owner: (id: number) => getJson<NormieOwner>(`/${id}/owner`),
  canvasInfo: (id: number) => getJson<CanvasInfo>(`/${id}/canvas/info`),
  canvasDiff: (id: number) => getJson<CanvasDiff>(`/${id}/canvas/diff`),
  agentInfo: (id: number) => getJson<AgentInfo>(`/${id}/agent`),
  agentBinding: (id: number) => getJson<any>(`/agents/binding/${id}`),
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

/** Fetches every public surface for a Normie in parallel. */
export async function fetchNormieSnapshot(tokenId: number): Promise<NormieSnapshot> {
  const [metadata, traits, owner, canvas, canvasDiff, agent] = await Promise.all([
    normiesApi.metadata(tokenId),
    normiesApi.traits(tokenId),
    normiesApi.owner(tokenId),
    normiesApi.canvasInfo(tokenId),
    normiesApi.canvasDiff(tokenId),
    normiesApi.agentInfo(tokenId),
  ])

  return {
    tokenId,
    metadata,
    traits,
    owner,
    canvas,
    canvasDiff,
    agent,
    imageUrl: normieImageUrl(tokenId),
  }
}
