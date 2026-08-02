"use client"

import { Button } from "@/components/ui/button"
import { useWalletGate } from "@/components/wallet-gate"
import { cn } from "@/lib/utils"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { Wallet } from "lucide-react"

/**
 * The single wallet entry point for the whole site.
 *
 * - Not connected → opens the RainbowKit connect modal (the ONLY place this is
 *   ever triggered from). While the site-wide "connect required" popup is open,
 *   this button pulses so the user can find it.
 * - Connected → opens our confirmed logout popup (not RainbowKit's account
 *   modal), so disconnecting always requires confirmation.
 *
 * Connection state is persisted by wagmi (localStorage) and shared app-wide via
 * the providers in the root layout, so it stays connected until the user logs
 * out. Supports delegates + ENS (hot wallet pattern).
 */
export function ConnectWallet() {
  const { connectPromptOpen, promptDisconnect } = useWalletGate()

  return (
    <ConnectButton.Custom>
      {({ account, chain, openChainModal, openConnectModal, mounted }) => {
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
                  <Button
                    onClick={openConnectModal}
                    size="sm"
                    variant="outline"
                    className={cn(
                      "gap-2",
                      connectPromptOpen &&
                        "ring-2 ring-primary ring-offset-2 ring-offset-background animate-pulse",
                    )}
                  >
                    <Wallet className="size-4" />
                    Connect
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
                  onClick={promptDisconnect}
                  size="sm"
                  variant="secondary"
                  className="gap-2 font-mono tracking-widest"
                  title="Log out"
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
