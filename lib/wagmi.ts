"use client"

import { ZULO } from "@/constants/contracts"
import { getDefaultConfig } from "@rainbow-me/rainbowkit"
import { http } from "viem"
import { mainnet } from "wagmi/chains"
import { RPC_URL } from "@/lib/viem-client"

/**
 * Wagmi + RainbowKit configuration (using Reown/AppKit-era best practices).
 *
 * READ-HEAVY by design. The only write-style interaction anywhere in this app
 * is a plain `signMessage` for identity linkage — never a transfer or approval.
 *
 * Explicit transports + metadata for reliable CORS + proper WalletConnect branding.
 */
/**
 * WalletConnect v2 Project ID (public, safe to embed).
 * Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID in Vercel / .env for production.
 */
const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "496bdf12e0267f014d4a8f92d305a9e8"

/**
 * Explicit transport using a CORS-friendly public RPC.
 * Prevents "Failed to fetch" / CORS errors from browser on Vercel (normies-cred-hub-dashboard.vercel.app)
 * against default viem public RPCs like https://eth.merkle.io .
 */
const appUrl =
  (typeof window !== 'undefined' ? window.location.origin : undefined) ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'https://normies-cred-hub-dashboard.vercel.app';

export const wagmiConfig = getDefaultConfig({
  appName: 'NormiesCredHub',
  appDescription: 'See the real reputation of your awakened ERC-8004 Normie agent.',
  appUrl,
  appIcon: 'https://normies-cred-hub-dashboard.vercel.app/icon.png',
  projectId,
  chains: [mainnet],
  transports: {
    [mainnet.id]: http(RPC_URL),
  },
  // Using the flat app* fields (RainbowKit's version of Reown AppKit metadata)
  // Improves branding in WalletConnect modals, QR codes, and connected wallets.
  ssr: true,
})

export const PRIMARY_CHAIN_ID = ZULO.chainId
