"use client"

import { useEffect, useRef, useState } from "react"
import { useAccount } from "wagmi"

import { useActiveNormie } from "@/components/active-normie-provider"
import { ConnectWallet } from "@/components/connect-wallet"
import { normieImageUrl } from "@/lib/api/normies"
import { cn } from "@/lib/utils"

/**
 * Compact header control: shows active Normie pixel + id; opens list of controlled set.
 */
export function ActiveNormieSwitcher({
  className,
}: {
  className?: string
}) {
  const { isConnected } = useAccount()
  const {
    activeTokenId,
    setActiveTokenId,
    controlledNormies,
    isLoading,
    hasWallet,
  } = useActiveNormie()

  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    function onPointer(e: MouseEvent | TouchEvent) {
      const el = rootRef.current
      if (!el) return
      if (e.target instanceof Node && !el.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener("keydown", onKey)
    document.addEventListener("mousedown", onPointer)
    document.addEventListener("touchstart", onPointer)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("mousedown", onPointer)
      document.removeEventListener("touchstart", onPointer)
    }
  }, [open])

  if (!isConnected || !hasWallet) {
    return (
      <div className={cn("active-normie-switcher", className)}>
        <div className="active-normie-empty" title="Connect wallet to switch Normies">
          <span className="active-normie-empty-label mono">Active</span>
          <span className="active-normie-empty-hint">Connect wallet</span>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("active-normie-switcher", className)} ref={rootRef}>
      <button
        type="button"
        className={cn("active-normie-trigger", open && "is-open")}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Active Normie #${activeTokenId}`}
      >
        <span className="active-normie-pixel">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={normieImageUrl(activeTokenId)}
            alt=""
            width={28}
            height={28}
          />
        </span>
        <span className="active-normie-meta">
          <span className="active-normie-kicker mono">Active</span>
          <span className="active-normie-id mono">#{activeTokenId}</span>
        </span>
        <span className={cn("pulse-toggle-chevron", open && "is-open")}>▼</span>
      </button>

      {open ? (
        <div className="active-normie-panel" role="listbox" aria-label="Controlled Normies">
          {isLoading ? (
            <p className="active-normie-panel-hint mono">Loading…</p>
          ) : controlledNormies.length === 0 ? (
            <p className="active-normie-panel-hint">
              No controlled or delegated Normies on this wallet.
            </p>
          ) : (
            <ul className="active-normie-list">
              {controlledNormies.map((n) => {
                const active = n.tokenId === activeTokenId
                return (
                  <li key={n.tokenId}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={cn(
                        "active-normie-option",
                        active && "is-active",
                      )}
                      onClick={() => {
                        setActiveTokenId(n.tokenId)
                        setOpen(false)
                      }}
                    >
                      <span className="active-normie-pixel">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={normieImageUrl(n.tokenId)}
                          alt=""
                          width={28}
                          height={28}
                        />
                      </span>
                      <span className="active-normie-option-text">
                        <span className="mono">#{n.tokenId}</span>
                        <span className="active-normie-option-sub">
                          {n.isAwakened ? "Awakened" : n.type || "Normie"}
                          {active ? " · Active" : ""}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}

/** Tiny persistent badge for Moves / Ask surfaces. */
export function ActiveNormieBadge({ className }: { className?: string }) {
  const { activeTokenId, hasWallet } = useActiveNormie()

  return (
    <div className={cn("active-normie-badge", className)}>
      <span className="active-normie-pixel active-normie-pixel-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={normieImageUrl(activeTokenId)}
          alt=""
          width={20}
          height={20}
        />
      </span>
      <span className="mono">
        Active · #{activeTokenId}
        {!hasWallet ? " · demo" : ""}
      </span>
    </div>
  )
}

/** Optional: wallet + switcher cluster for headers that already show ConnectWallet. */
export function ActiveNormieHeaderCluster() {
  return (
    <span className="active-normie-header-cluster">
      <ActiveNormieSwitcher />
      <ConnectWallet />
    </span>
  )
}
