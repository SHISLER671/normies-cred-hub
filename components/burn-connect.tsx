"use client"

import { ConnectButton } from "@rainbow-me/rainbowkit"
import { useAccount } from "wagmi"

/**
 * OPTIONAL convenience on /burn: fill the wallet box from a connected wallet.
 *
 * Read-only by construction: this file only calls `useAccount` (the public address) and opens the connect
 * modal. It never imports a sign or write hook, so it cannot ask for a signature or a transaction.
 * The page works fully without it; the main path is pasting an address.
 */
export function BurnConnect({ goal }: { goal: string }) {
  const { address, isConnected } = useAccount()

  if (isConnected && address) {
    return (
      <a className="burn-button" href={`/burn?wallet=${address}&goal=${encodeURIComponent(goal)}`}>
        Use my connected wallet ({address.slice(0, 6)}…{address.slice(-4)})
      </a>
    )
  }

  return (
    <ConnectButton.Custom>
      {({ openConnectModal, mounted }) => (
        <button type="button" className="burn-button burn-button-ghost" onClick={openConnectModal} disabled={!mounted}>
          Connect a wallet
        </button>
      )}
    </ConnectButton.Custom>
  )
}
