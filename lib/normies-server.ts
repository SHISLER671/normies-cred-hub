import { NORMIES_API_BASE } from "@/constants/contracts"
import { fetchWithRetry } from "@/lib/fetch-with-retry"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"
import { mapLimit } from "@/lib/map-limit"
import { loadNormieTraits, serverNormiesJsonWith, traitType } from "@/lib/normie-traits"
import type { OwnedNormie } from "@/lib/types"

type AgentIdentityResponse = {
  tokenId: number
  name: string
  type: string
}

type BindingBatchResponse = {
  bindings: Record<string, { agentId?: string }>
}

async function fetchBindingsBatchServer(
  tokenIds: number[],
): Promise<BindingBatchResponse["bindings"]> {
  if (tokenIds.length === 0) return {}

  const res = await fetchWithRetry(
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

/** Identity reads run at most this many at a time, each capped, and stop after the budget (route maxDuration is 10s). */
const ENRICH_CONCURRENCY = 8
const ENRICH_CALL_TIMEOUT_MS = 4_000
const ENRICH_BUDGET_MS = 6_000

async function quickJson<T>(path: string): Promise<T> {
  const res = await fetchWithTimeout(`${NORMIES_API_BASE}${path}`, {}, ENRICH_CALL_TIMEOUT_MS)
  if (!res.ok) throw new Error(`Normies API error (${res.status}) for ${path}`)
  return res.json() as Promise<T>
}

/**
 * Server-side enrichment using direct Normies API calls. The type label is best-effort: past the time budget a Normie
 * is listed as "Unknown" instead of the whole lookup timing out. Ownership itself never depends on this.
 */
export async function enrichOwnedNormiesServer(tokenIds: number[]): Promise<OwnedNormie[]> {
  if (tokenIds.length === 0) return []
  const deadline = Date.now() + ENRICH_BUDGET_MS
  const unknown = (id: number): AgentIdentityResponse => ({ tokenId: id, name: `Normie #${id}`, type: "Unknown" })

  const [bindings, identities] = await Promise.all([
    fetchBindingsBatchServer(tokenIds).catch(() => ({} as BindingBatchResponse["bindings"])),
    mapLimit(tokenIds, ENRICH_CONCURRENCY, async (id) => {
      if (Date.now() > deadline) return unknown(id)
      // Current type from the official /metadata (lib/normie-traits.ts). /agents/identity is the mint type (Zombie #2 was
      // minted Human), so it is only the fallback.
      const type = traitType(await loadNormieTraits(id, serverNormiesJsonWith(ENRICH_CALL_TIMEOUT_MS)))
      if (type) return { tokenId: id, name: `Normie #${id}`, type }
      if (Date.now() > deadline) return unknown(id)
      try {
        return await quickJson<AgentIdentityResponse>(`/agents/identity/${id}`)
      } catch {
        return unknown(id)
      }
    }),
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