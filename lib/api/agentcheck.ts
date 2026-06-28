import { basePublicClient } from "@/lib/viem-client"
import type { AgentCheckResult } from "@/lib/types"
import { AGENT_CHECK, AGENT_CHECK_REGISTRY_ABI } from "@/constants/contracts"
import { getAddress } from "viem"

/**
 * AgentCheck trust signal (ERC-8257 Tool #13).
 * Client-side helper that calls our own `/api/agentcheck` proxy route, which
 * forwards to https://agentcheck-bice.vercel.app/api/check?wallet=...
 * Public lookup — no wallet auth required. Returns rating (AAA–D), trust/risk
 * scores, verdict, highlights, and flags.
 */
export async function fetchAgentCheck(wallet?: string): Promise<AgentCheckResult | null> {
  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) return null

  try {
    const res = await fetch(`/api/agentcheck?wallet=${wallet.toLowerCase()}`)
    if (!res.ok) return null
    return (await res.json()) as AgentCheckResult
  } catch {
    // Fail silently as recommended by the AgentCheck author
    return null
  }
}

/**
 * On-chain certification check (no API trust).
 * Uses the AgentCheck registry on Base.
 */
export async function isAgentCertified(wallet?: string): Promise<boolean | null> {
  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) return null
  try {
    const normalized = getAddress(wallet) as `0x${string}`
    return await basePublicClient.readContract({
      address: AGENT_CHECK.REGISTRY,
      abi: AGENT_CHECK_REGISTRY_ABI,
      functionName: "isCertified",
      args: [normalized],
    }) as boolean
  } catch {
    return null
  }
}
