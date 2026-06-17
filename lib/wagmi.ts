"use client"

import { ZULO } from "@/constants/contracts"
import { getDefaultConfig } from "@rainbow-me/rainbowkit"
import { mainnet } from "wagmi/chains"

/**
 * Wagmi + RainbowKit configuration.
 *
 * READ-HEAVY by design. The only write-style interaction anywhere in this app
 * is a plain `signMessage` for identity linkage — never a transfer or approval.
 *
 * A WalletConnect projectId enables mobile/QR wallets. Without one, injected
 * (browser) wallets still work fine, so the app degrades gracefully.
 */
const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "normiescredhub-demo"

export const wagmiConfig = getDefaultConfig({
  appName: "NormiesCredHub",
  projectId,
  chains: [mainnet],
  ssr: true,
})

export const PRIMARY_CHAIN_ID = ZULO.chainId
