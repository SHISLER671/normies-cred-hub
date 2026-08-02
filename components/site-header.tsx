"use client"

import { ConnectWallet } from "@/components/connect-wallet"
import { ZuloChromeHeader } from "@/components/zulo-chrome-header"

/**
 * Shared site chrome — same Zulo monochrome header as /, /paths, /ask.
 * Kept as a client wrapper so ConnectWallet works on the dashboard.
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
