"use client"

import { Button } from "@/components/ui/button"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { Wallet } from "lucide-react"

/**
 * Wallet connection is optional for browsing.
 * Connect (via RainbowKit + Reown) to make the dashboard come alive with *your* awakened Normie.
 * Supports delegates + ENS (hot wallet pattern).
 */
export function ConnectWallet() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const ready = mounted
        const connected = ready && account && chain

        return (
          <div
            aria-hidden={!ready}
            className={!ready ? "pointer-events-none opacity-0" : undefined}
          >
            {(() => {
              if (!connected) {
                return (
                  <Button onClick={openConnectModal} size="sm" variant="outline" className="gap-2 uppercase tracking-widest">
                    <Wallet className="size-4" />
                    CONNECT
                  </Button>
                )
              }

              if (chain.unsupported) {
                return (
                  <Button onClick={openChainModal} size="sm" variant="destructive">
                    Wrong network
                  </Button>
                )
              }

              return (
                <Button
                  onClick={openAccountModal}
                  size="sm"
                  variant="secondary"
                  className="gap-2 font-mono uppercase tracking-widest"
                >
                  <span className="size-1.5 bg-emerald-400" aria-hidden />
                  {account.ensName || account.displayName}
                </Button>
              )
            })()}
          </div>
        )
      }}
    </ConnectButton.Custom>
  )
}
