"use client"

import { ConnectWallet } from "@/components/connect-wallet"
import { ZuloChromeHeader } from "@/components/zulo-chrome-header"

/**
 * Shared site chrome — Normies CredHub monochrome header (PULSE · Ask · Moves).
 * Client wrapper so ConnectWallet works on /dashboard (PULSE).
 */
export function SiteHeader({
  active = "dashboard",
}: {
  active?: "home" | "ask" | "paths" | "moves" | "dashboard"
}) {
  return (
    <ZuloChromeHeader
      active={active}
      trailing={
        <span style={{ display: "inline-flex", alignItems: "center" }}>
          <ConnectWallet />
        </span>
      }
    />
  )
}
