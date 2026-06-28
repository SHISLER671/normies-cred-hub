"use client"

import { fetchEthosScore } from "@/lib/api/ethos"
import { fetchAgentCheck } from "@/lib/api/agentcheck"
import { fetchNormieSnapshot, normiesApi } from "@/lib/api/normies"
import { useQuery } from "@tanstack/react-query"

/** Full Normie snapshot (metadata + traits + owner + canvas + agent). */
export function useNormie(tokenId: number) {
  return useQuery({
    queryKey: ["normie", tokenId],
    queryFn: () => fetchNormieSnapshot(tokenId),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  })
}

/** Just the agent persona (used by the Zulo Suggests modal). */
export function useAgent(tokenId: number) {
  return useQuery({
    queryKey: ["agent", tokenId],
    queryFn: () => normiesApi.agentInfo(tokenId),
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Ethos credibility score for an address. Cached 5–15 min per the PDR.
 * Disabled until a valid-looking address is provided.
 */
export function useEthosScore(address?: string) {
  const enabled = !!address && /^0x[a-fA-F0-9]{40}$/.test(address)
  return useQuery({
    queryKey: ["ethos", address?.toLowerCase()],
    queryFn: () => fetchEthosScore(address as string),
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  })
}

/**
 * AgentCheck wallet trust rating for an address (ERC-8257 Tool #13).
 * Disabled until a valid-looking address is provided. Cached 5–15 min.
 */
export function useAgentCheck(address?: string) {
  const enabled = !!address && /^0x[a-fA-F0-9]{40}$/.test(address)
  return useQuery({
    queryKey: ["agentcheck", address?.toLowerCase()],
    queryFn: () => fetchAgentCheck(address as string),
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  })
}
