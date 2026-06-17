"use client"

import { ConnectWallet } from "@/components/connect-wallet"
import { Hexagon } from "lucide-react"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <a href="/" className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Hexagon className="size-5" />
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-heading text-base font-bold tracking-tight">NormiesCredHub</span>
            <span className="text-[11px] text-muted-foreground">Agent reputation, on-chain</span>
          </span>
        </a>
        <ConnectWallet />
      </div>
    </header>
  )
}
