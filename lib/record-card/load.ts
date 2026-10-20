// Normie record card — server loader. Read-only: official api.normies.art routes, the Pulse (which reads ERC-8004 on-chain
// and Hive chat ratings), and the Arena plug-in. Every read fails open to `unavailable`, never to a made-up value.

import { NORMIES_API_BASE } from "@/constants/contracts"
import { getAgentPulse } from "@/lib/api/agent-pulse"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"
import { loadNormieTraits } from "@/lib/normie-traits"

import { loadArenaSector } from "./arena"
import { buildRecordCard, type RecordCardInputs } from "./build"
import type { RecordCard } from "./types"

async function normies<T>(path: string): Promise<T | null> {
  try {
    const res = await fetchWithTimeout(
      `${NORMIES_API_BASE}${path}`,
      { headers: { Accept: "application/json" }, next: { revalidate: 300 } },
      8_000,
    )
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export async function loadRecordCard(tokenId: number): Promise<RecordCard> {
  const now = new Date().toISOString()
  const [binding, identity, canvas, owner, zombie, pulse, arena, baseTraits] = await Promise.all([
    normies<{ binding?: RecordCardInputs["binding"] }>(`/agents/binding/${tokenId}`),
    normies<NonNullable<RecordCardInputs["identity"]>>(`/agents/identity/${tokenId}`),
    normies<NonNullable<RecordCardInputs["canvas"]>>(`/normie/${tokenId}/canvas/info`),
    normies<NonNullable<RecordCardInputs["owner"]>>(`/normie/${tokenId}/owner`),
    normies<NonNullable<RecordCardInputs["zombie"]>>(`/normie/${tokenId}/zombie`),
    getAgentPulse(tokenId, { chatRatings: true }).catch(() => null),
    loadArenaSector(tokenId, now),
    loadNormieTraits(tokenId, normies),
  ])

  const pulseData = pulse && pulse.ok ? pulse.data : null

  return buildRecordCard({
    tokenId,
    now,
    binding: binding?.binding ?? null,
    identity,
    baseTraits,
    canvas,
    owner,
    zombie,
    pulse: pulseData,
    chatRatings: pulseData?.chat_ratings ?? null,
    arena,
  })
}
