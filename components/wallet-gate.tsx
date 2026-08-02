"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { shortenAddress } from "@/lib/format"
import { ArrowUpRight, LogOut, Wallet } from "lucide-react"
import { createContext, useCallback, useContext, useMemo, useState } from "react"
import { useAccount, useDisconnect, useEnsName } from "wagmi"

type WalletGateContextValue = {
  /** True while the "please connect from the header" popup is open. */
  connectPromptOpen: boolean
  /** Open the popup instructing the user to click the header Connect button. */
  promptConnect: (reason?: string) => void
  /** Run `action` if a wallet is connected; otherwise show the connect popup. */
  requireWallet: (action: () => void, reason?: string) => void
  /** Open the confirmed logout popup. */
  promptDisconnect: () => void
}

const WalletGateContext = createContext<WalletGateContextValue | null>(null)

/**
 * Site-wide wallet gate.
 *
 * Connection is ONLY ever initiated by the top-right Connect button in the
 * header (RainbowKit modal lives in `ConnectWallet`). Everywhere else that
 * needs a wallet calls `requireWallet` / `promptConnect`, which shows a popup
 * pointing the user at that single Connect button instead of opening a second
 * connect modal. Logout is always confirmed.
 */
export function WalletGateProvider({ children }: { children: React.ReactNode }) {
  const { address, isConnected } = useAccount()
  const { data: ensName } = useEnsName({ address })
  const { disconnect } = useDisconnect()

  const [connectPromptOpen, setConnectPromptOpen] = useState(false)
  const [connectReason, setConnectReason] = useState<string | null>(null)
  const [disconnectPromptOpen, setDisconnectPromptOpen] = useState(false)

  const promptConnect = useCallback((reason?: string) => {
    setConnectReason(reason ?? null)
    setConnectPromptOpen(true)
  }, [])

  const requireWallet = useCallback(
    (action: () => void, reason?: string) => {
      if (isConnected && address) {
        action()
      } else {
        promptConnect(reason)
      }
    },
    [isConnected, address, promptConnect],
  )

  const promptDisconnect = useCallback(() => {
    setDisconnectPromptOpen(true)
  }, [])

  const value = useMemo<WalletGateContextValue>(
    () => ({ connectPromptOpen, promptConnect, requireWallet, promptDisconnect }),
    [connectPromptOpen, promptConnect, requireWallet, promptDisconnect],
  )

  return (
    <WalletGateContext.Provider value={value}>
      {children}

      {/* Connect instruction popup — never opens a second connect modal */}
      <Dialog open={connectPromptOpen} onOpenChange={setConnectPromptOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="size-5 text-primary" />
              Wallet required
            </DialogTitle>
            <DialogDescription className="text-left">
              {connectReason
                ? connectReason
                : "This action needs a connected wallet."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-start gap-3 rounded-none border border-primary/30 bg-primary/5 p-3 text-sm">
            <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-primary" />
            <p className="text-pretty leading-relaxed">
              Click the{" "}
              <span className="font-semibold text-foreground">Connect</span>{" "}
              button in the top-right corner of the header to connect your
              wallet, then try again.
            </p>
          </div>

          <DialogFooter>
            <Button
              onClick={() => setConnectPromptOpen(false)}
              className="w-full"
            >
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmed logout popup */}
      <Dialog open={disconnectPromptOpen} onOpenChange={setDisconnectPromptOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogOut className="size-5" />
              Log out?
            </DialogTitle>
            <DialogDescription className="text-left">
              {address ? (
                <>
                  You&apos;re connected as{" "}
                  <span className="font-mono text-foreground">
                    {ensName || shortenAddress(address)}
                  </span>
                  . You can reconnect anytime from the Connect button in the
                  header.
                </>
              ) : (
                "You can reconnect anytime from the Connect button in the header."
              )}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setDisconnectPromptOpen(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                disconnect()
                setDisconnectPromptOpen(false)
              }}
              className="w-full gap-2 sm:w-auto"
            >
              <LogOut className="size-4" />
              Log out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WalletGateContext.Provider>
  )
}

export function useWalletGate(): WalletGateContextValue {
  const ctx = useContext(WalletGateContext)
  if (!ctx) {
    throw new Error("useWalletGate must be used within a WalletGateProvider")
  }
  return ctx
}
