"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { shortenAddress } from "@/lib/format"
import { CheckCircle2, Fingerprint, ShieldAlert, ShieldCheck, XCircle } from "lucide-react"
import { useState } from "react"
import { useAccount, useSignMessage } from "wagmi"

type Status = "idle" | "signing" | "matched" | "mismatch" | "error"

function buildMessage(tokenId: number, address: string) {
  return [
    "NormiesCredHub — Identity Linkage Proof",
    "",
    `I am proving control of this wallet to link it with Normie #${tokenId}.`,
    `Wallet: ${address}`,
    `Token: Normie #${tokenId}`,
    `Issued: ${new Date().toISOString()}`,
    "",
    "This is a signature only. It authorizes NO transactions, transfers, or approvals.",
  ].join("\n")
}

export function LinkageProofModal({
  tokenId,
  ownerAddress,
  delegateAddress,
  open,
  onOpenChange,
}: {
  tokenId: number
  ownerAddress: string
  delegateAddress?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const { address, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const [status, setStatus] = useState<Status>("idle")
  const [internalOpen, setInternalOpen] = useState(false)

  const isOpen = open !== undefined ? open : internalOpen
  const setIsOpen = (o: boolean) => {
    if (onOpenChange) {
      onOpenChange(o)
    } else {
      setInternalOpen(o)
    }
    if (!o) reset()
  }

  async function handleSign() {
    if (!address) return
    setStatus("signing")
    try {
      await signMessageAsync({ message: buildMessage(tokenId, address) })
      const addr = address.toLowerCase()
      const matchesOwner = addr === ownerAddress.toLowerCase()
      const matchesDelegate = !!delegateAddress && delegateAddress !== '0x0000000000000000000000000000000000000000' && addr === delegateAddress.toLowerCase()
      setStatus((matchesOwner || matchesDelegate) ? "matched" : "mismatch")
    } catch {
      setStatus("error")
    }
  }

  function reset() {
    setStatus("idle")
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md bg-popover border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Fingerprint className="size-5 text-primary" />
            Identity Linkage Proof
          </DialogTitle>
          <DialogDescription>
            Cryptographically prove you control a wallet and link it to this agent
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-2xl border border-primary/30 bg-card p-4">
            <p className="font-medium mb-1">Safety first</p>
            <p className="text-sm text-muted-foreground">
              This is a signature only — no transactions, transfers, or approvals are ever requested.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between rounded-2xl border border-border bg-card p-3 text-sm">
              <span className="text-muted-foreground">Expected controller (owner or delegate)</span>
              <span className="font-mono">{shortenAddress(ownerAddress)}{delegateAddress && delegateAddress !== '0x0000000000000000000000000000000000000000' ? ` / ${shortenAddress(delegateAddress)}` : ''}</span>
            </div>
            <div className="flex justify-between rounded-2xl border border-border bg-card p-3 text-sm">
              <span className="text-muted-foreground">Your connected wallet</span>
              <span className="font-mono">
                {isConnected && address ? shortenAddress(address) : "Not connected"}
              </span>
            </div>
          </div>

          {status === "matched" && <Result kind="ok" tokenId={tokenId} />}
          {status === "mismatch" && <Result kind="mismatch" tokenId={tokenId} />}
          {status === "error" && <Result kind="error" tokenId={tokenId} />}

          {!isConnected ? (
            <p className="text-center text-sm text-muted-foreground py-4">
              Connect your wallet to generate a proof.
            </p>
          ) : status === "matched" || status === "mismatch" ? (
            <Button variant="outline" onClick={reset} className="w-full">
              Run another check
            </Button>
          ) : (
            <Button onClick={handleSign} disabled={status === "signing"} className="w-full gap-2">
              <Fingerprint className="size-4" />
              {status === "signing" ? "Awaiting signature…" : "Sign & Verify"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Result({ kind, tokenId }: { kind: "ok" | "mismatch" | "error"; tokenId: number }) {
  const map = {
    ok: { icon: CheckCircle2, title: "Linkage Verified", body: `Your wallet matches the on-chain owner or delegate of Normie #${tokenId}.`, className: "border-green-500/30 bg-green-500/10" },
    mismatch: { icon: ShieldAlert, title: "Wallet Mismatch", body: "Signature valid, but this is not the owner or delegate.", className: "border-amber-500/30 bg-amber-500/10" },
    error: { icon: XCircle, title: "Signature Cancelled", body: "No action was taken.", className: "border-destructive/30 bg-destructive/10" },
  }[kind]

  const Icon = map.icon

  return (
    <div className={`rounded-2xl border p-4 ${map.className}`}>
      <div className="flex items-start gap-3">
        <Icon className="size-5 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">{map.title}</p>
          <p className="text-xs tracking-[1.5px] text-muted-foreground mt-1">{map.body}</p>
        </div>
      </div>
    </div>
  )
}
