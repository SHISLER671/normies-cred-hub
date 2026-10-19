"use client"

import { ConnectButton } from "@rainbow-me/rainbowkit"
import { useState } from "react"
import { useAccount } from "wagmi"

import { MAX_ROOM } from "@/lib/symphony/pin"

/**
 * "Play my Normies": load the Normies a connected wallet controls (owner, Delegate.xyz vault, or Canvas delegate) into a
 * room. Read-only by construction: this file only calls `useAccount` (the public address) and opens the connect modal.
 * It never imports a sign or write hook, so it cannot ask for a signature or a transaction. The wallet address is
 * never put in the URL or the share link; only token ids are.
 */
export function PlayMine({ onIds, disabled }: { onIds: (ids: number[], total: number) => void; disabled?: boolean }) {
  const { address, isConnected } = useAccount()
  const [state, setState] = useState<"idle" | "loading" | "none" | "error">("idle")

  async function load() {
    if (!address) return
    setState("loading")
    try {
      const r = await fetch(`/api/my-normies?address=${address}`)
      if (!r.ok) throw new Error(String(r.status))
      const d = (await r.json()) as { normies?: Array<{ tokenId: number }> }
      const ids = [...new Set((d.normies ?? []).map((n) => Number(n.tokenId)).filter((n) => Number.isInteger(n) && n >= 0))].sort((a, b) => a - b)
      if (!ids.length) {
        setState("none")
        return
      }
      setState("idle")
      onIds(ids.slice(0, MAX_ROOM), ids.length)
    } catch {
      setState("error")
    }
  }

  return (
    <div className="sym-mine">
      {isConnected && address ? (
        <button type="button" className="sym-btn" onClick={load} disabled={disabled || state === "loading"}>
          {state === "loading" ? "Finding…" : "Play my Normies"}
        </button>
      ) : (
        <ConnectButton.Custom>
          {({ openConnectModal, mounted }) => (
            <button type="button" className="sym-btn" onClick={openConnectModal} disabled={!mounted}>
              Connect to play my Normies
            </button>
          )}
        </ConnectButton.Custom>
      )}
      {state === "none" && <span className="sym-hint">No Normies found for this wallet.</span>}
      {state === "error" && <span className="sym-hint">Couldn&apos;t look up this wallet right now. Try again.</span>}
    </div>
  )
}
