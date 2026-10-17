"use client"

import { useQuery } from "@tanstack/react-query"

import type { ChatRatingsSummary } from "@/lib/chat-ratings/load"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"

async function fetchChatRatings(agentId: number): Promise<ChatRatingsSummary> {
  const res = await fetchWithTimeout(
    `/api/chat-ratings/${agentId}`,
    { headers: { Accept: "application/json" } },
    10_000,
  )
  if (!res.ok) throw new Error(`Chat ratings request failed (${res.status})`)
  return (await res.json()) as ChatRatingsSummary
}

/**
 * Ranked Hive chat ratings for an ERC-8004 agent. Read-only (server reads the Reputation Registry).
 * Disabled until a positive agent id is known. Cached 5–15 min like the other trust cards.
 */
export function useChatRatings(agentId?: number | string | null) {
  const id = typeof agentId === "string" ? Number.parseInt(agentId, 10) : agentId ?? NaN
  const enabled = Number.isSafeInteger(id) && (id as number) > 0
  return useQuery({
    queryKey: ["chat-ratings", enabled ? id : null],
    queryFn: () => fetchChatRatings(id as number),
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 1,
  })
}
