"use client"

import { Button } from "@/components/ui/button"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { Wallet } from "lucide-react"

/**
 * Custom-styled wallet connect control built on RainbowKit's headless API,
 * so it matches the luxe dark theme. Connecting is OPTIONAL — public views
 * work without a wallet.
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
                  <Button onClick={openConnectModal} size="sm" className="gap-2">
                    <Wallet className="size-4" />
                    Connect Wallet
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
                  className="gap-2 font-mono"
                >
                  <span className="size-2 rounded-full bg-chart-5" aria-hidden />
                  {account.displayName}
                </Button>
              )
            })()}
          </div>
        )
      }}
    </ConnectButton.Custom>
  )
}
