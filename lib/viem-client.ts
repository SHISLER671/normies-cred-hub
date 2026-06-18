import { createPublicClient, http } from "viem"
import { mainnet } from "viem/chains"

/**
 * Shared public client for direct viem reads (useMyNormies, useEnsName, etc.).
 *
 * IMPORTANT: We use an explicit public RPC that supports CORS from the deployed Vercel app.
 * Default viem/wagmi public RPCs (e.g. eth.merkle.io) block CORS for browser clients on vercel.app domains.
 * This fixes "Failed to fetch" / CORS errors on eth_call / readContract / getEnsName.
 */
export const RPC_URL = "https://ethereum.publicnode.com"

export const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(RPC_URL),
})
