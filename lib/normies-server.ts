import { NORMIES_API_BASE } from "@/constants/contracts"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"
import type { OwnedNormie } from "@/lib/types"

type AgentIdentityResponse = {
  tokenId: number
  name: string
  type: string
}

type BindingBatchResponse = {
  bindings: Record<string, { agentId?: string }>
}

type NormieTraits = {
  attributes: Array<{ trait_type: string; value: string | number }>
}

async function fetchUpstreamJson<T>(path: string): Promise<T> {
  const res = await fetchWithTimeout(`${NORMIES_API_BASE}${path}`, {}, 10_000)
  if (!res.ok) {
    throw new Error(`Normies API error (${res.status}) for ${path}`)
  }
  return res.json() as Promise<T>
}

async function fetchBindingsBatchServer(
  tokenIds: number[],
): Promise<BindingBatchResponse["bindings"]> {
  if (tokenIds.length === 0) return {}

  const res = await fetchWithTimeout(
    `${NORMIES_API_BASE}/agents/binding/batch`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokenIds }),
    },
    15_000,
  )

  if (!res.ok) {
    throw new Error(`Normies batch binding error (${res.status})`)
  }

  const data = (await res.json()) as BindingBatchResponse
  return data.bindings ?? {}
}

/** Server-side enrichment using direct Normies API calls. */
export async function enrichOwnedNormiesServer(tokenIds: number[]): Promise<OwnedNormie[]> {
  if (tokenIds.length === 0) return []

  const [bindings, identities] = await Promise.all([
    fetchBindingsBatchServer(tokenIds).catch(() => ({} as BindingBatchResponse["bindings"])),
    Promise.all(
      tokenIds.map(async (id) => {
        try {
          return await fetchUpstreamJson<AgentIdentityResponse>(`/agents/identity/${id}`)
        } catch {
          try {
            const traits = await fetchUpstreamJson<NormieTraits>(`/normie/${id}/traits`)
            const type =
              traits.attributes.find((t) => t.trait_type === "Type")?.value?.toString() ??
              "Unknown"
            return { tokenId: id, name: `Normie #${id}`, type }
          } catch {
            return { tokenId: id, name: `Normie #${id}`, type: "Unknown" }
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