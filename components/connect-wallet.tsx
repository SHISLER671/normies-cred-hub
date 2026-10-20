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
      {({ account, chain, openConnectModal, mounted }) => {
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

              // NCH only reads Ethereum through its own connection and the only signature is a plain signMessage, which
              // works on any network. So a wallet on another network is not an error: no red "Wrong network", no
              // switch prompt. It shows as connected, with a note in the tooltip.
              const otherNetwork = !!chain.unsupported

              return (
                <Button
                  onClick={promptDisconnect}
                  size="sm"
                  variant="secondary"
                  className="gap-2 font-mono tracking-widest"
                  title={
                    otherNetwork
                      ? "Connected. Your wallet is on another network; NCH only reads Ethereum, so there is nothing to switch. Tap to log out."
                      : "Log out"
                  }
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
