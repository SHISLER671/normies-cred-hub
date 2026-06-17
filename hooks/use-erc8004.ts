"use client"

import { useReadContracts } from "wagmi"
import { ERC8004, IDENTITY_REGISTRY_READ_ABI, ZULO } from "@/constants/contracts"

export interface Erc8004Result {
  agentId: number
  /** The agentURI registered on-chain (points to the agent's metadata/card). */
  agentURI: string | null
  /** The on-chain owner address of this agent registration. */
  registeredOwner: string | null
  isLoading: boolean
  isError: boolean
  /** True when both reads resolved without error. */
  verified: boolean
}

/**
 * Reads the ERC-8004 Identity Registry on Ethereum mainnet for a given agentId.
 * Purely read-only (agentURI + ownerOf). No writes, no approvals, no signing.
 */
export function useErc8004(agentId: number = ZULO.agentId): Erc8004Result {
  const { data, isLoading, isError } = useReadContracts({
    contracts: [
      {
        address: ERC8004.IDENTITY_REGISTRY as `0x${string}`,
        abi: IDENTITY_REGISTRY_READ_ABI,
        functionName: "agentURI",
        args: [BigInt(agentId)],
        chainId: 1,
      },
      {
        address: ERC8004.IDENTITY_REGISTRY as `0x${string}`,
        abi: IDENTITY_REGISTRY_READ_ABI,
        functionName: "ownerOf",
        args: [BigInt(agentId)],
        chainId: 1,
      },
    ],
    query: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  })

  const agentURI = data?.[0]?.status === "success" ? (data[0].result as string) : null
  const registeredOwner = data?.[1]?.status === "success" ? (data[1].result as string) : null

  return {
    agentId,
    agentURI,
    registeredOwner,
    isLoading,
    isError,
    verified: Boolean(agentURI || registeredOwner),
  }
}
