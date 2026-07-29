/**
 * Low-level ERC-6551 registry reads via viem.
 * Address derivation is done by the on-chain registry.account() view
 * (CREATE2 + ERC-1167 proxy encoding is the registry's job).
 */

import {
  type Address,
  type Hex,
  type PublicClient,
  encodeFunctionData,
  getAddress,
  isAddress,
} from "viem"

import {
  ERC6551_ACCOUNT_ABI,
  ERC6551_DEFAULT_SALT,
  ERC6551_IS_VALID_SIGNER_MAGIC,
  ERC6551_REGISTRY,
  ERC6551_REGISTRY_ABI,
  TOKENBOUND_ACCOUNT_PROXY,
  TOKENBOUND_V3_DEFAULTS,
  type Erc6551Version,
} from "./constants"
import type {
  ResolveAccountParams,
  ResolvedTokenBoundAccount,
  TokenBoundBinding,
} from "./types"

export function normalizeTokenId(tokenId: number | bigint): bigint {
  return typeof tokenId === "bigint" ? tokenId : BigInt(tokenId)
}

export function buildTokenBoundBinding(
  params: ResolveAccountParams,
  version: Erc6551Version = "tokenbound-v3",
): TokenBoundBinding {
  const tokenContract = getAddress(params.tokenContract)
  return {
    chainId: params.chainId,
    tokenContract,
    tokenId: normalizeTokenId(params.tokenId),
    implementation: getAddress(
      params.implementation ?? TOKENBOUND_ACCOUNT_PROXY,
    ),
    salt: (params.salt ?? ERC6551_DEFAULT_SALT) as Hex,
    registry: getAddress(params.registry ?? ERC6551_REGISTRY),
    version,
  }
}

export async function registryAccountAddress(
  client: PublicClient,
  binding: TokenBoundBinding,
): Promise<Address> {
  const address = await client.readContract({
    address: binding.registry,
    abi: ERC6551_REGISTRY_ABI,
    functionName: "account",
    args: [
      binding.implementation,
      binding.salt,
      BigInt(binding.chainId),
      binding.tokenContract,
      binding.tokenId,
    ],
  })
  return getAddress(address)
}

export async function isContractDeployed(
  client: PublicClient,
  address: Address,
): Promise<boolean> {
  const code = await client.getBytecode({ address })
  return !!code && code !== "0x"
}

export async function readAccountToken(
  client: PublicClient,
  account: Address,
): Promise<{ chainId: number; tokenContract: Address; tokenId: bigint } | null> {
  try {
    const [chainId, tokenContract, tokenId] = await client.readContract({
      address: account,
      abi: ERC6551_ACCOUNT_ABI,
      functionName: "token",
    })
    return {
      chainId: Number(chainId),
      tokenContract: getAddress(tokenContract),
      tokenId,
    }
  } catch {
    return null
  }
}

export async function readAccountState(
  client: PublicClient,
  account: Address,
): Promise<bigint | null> {
  try {
    return await client.readContract({
      address: account,
      abi: ERC6551_ACCOUNT_ABI,
      functionName: "state",
    })
  } catch {
    return null
  }
}

export async function isValidTbaSigner(
  client: PublicClient,
  account: Address,
  signer: Address,
  data: Hex = "0x",
): Promise<boolean> {
  if (!isAddress(signer)) return false
  try {
    const magic = await client.readContract({
      address: account,
      abi: ERC6551_ACCOUNT_ABI,
      functionName: "isValidSigner",
      args: [getAddress(signer), data],
    })
    return magic.toLowerCase() === ERC6551_IS_VALID_SIGNER_MAGIC.toLowerCase()
  } catch {
    return false
  }
}

export async function resolveTokenBoundAccount(
  client: PublicClient,
  params: ResolveAccountParams,
  version: Erc6551Version = TOKENBOUND_V3_DEFAULTS.version,
): Promise<ResolvedTokenBoundAccount> {
  const binding = buildTokenBoundBinding(params, version)
  const address = await registryAccountAddress(client, binding)
  const deployed = await isContractDeployed(client, address)

  if (!params.enrich || !deployed) {
    return { address, binding, deployed }
  }

  const [state, boundToken] = await Promise.all([
    readAccountState(client, address),
    readAccountToken(client, address),
  ])

  return {
    address,
    binding,
    deployed,
    state: state ?? undefined,
    boundToken: boundToken ?? undefined,
  }
}

export function encodeCreateAccountCall(binding: TokenBoundBinding) {
  const args = [
    binding.implementation,
    binding.salt,
    BigInt(binding.chainId),
    binding.tokenContract,
    binding.tokenId,
  ] as const

  return {
    to: binding.registry,
    data: encodeFunctionData({
      abi: ERC6551_REGISTRY_ABI,
      functionName: "createAccount",
      args,
    }),
    abi: ERC6551_REGISTRY_ABI,
    functionName: "createAccount" as const,
    args,
  }
}

/**
 * Depth-1 self-ownership cycle: depositing the bound NFT into its own TBA.
 * Deeper graphs are out of EIP on-chain scope — product should refuse when known.
 */
export function isSelfOwnershipCycle(input: {
  account: Address
  nftContract: Address
  nftTokenId: bigint
  binding: TokenBoundBinding
}): boolean {
  return (
    getAddress(input.nftContract) === getAddress(input.binding.tokenContract) &&
    input.nftTokenId === input.binding.tokenId
  )
}
