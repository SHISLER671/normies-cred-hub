import { basePublicClient } from "@/lib/viem-client"
import type { AgentCheckResult } from "@/lib/types"
import { AGENT_CHECK, AGENT_CHECK_REGISTRY_ABI } from "@/constants/contracts"
import { getAddress } from "viem"

/**
 * AgentCheck trust signal (ERC-8257 Tool #13).
 * Free public API for wallet reputation before interactions.
 * https://agentcheck-bice.vercel.app/api/check?wallet=...
 *
 * Returns rating (AAA-D), flags, sanctions, cert status, etc.
 * Fails silently recommended by the author.
 */
export async function fetchAgentCheck(wallet?: string): Promise<AgentCheckResult | null> {
  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) return null

  try {
    const res = await fetch(
      `https://agentcheck-bice.vercel.app/api/check?wallet=${wallet.toLowerCase()}`,
      { method: "GET" }
    )

    if (!res.ok) return null

    return (await res.json()) as AgentCheckResult
  } catch {
    // Fail silently as recommended
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
