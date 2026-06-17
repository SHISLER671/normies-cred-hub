"use client"

import { ConnectWallet } from "@/components/connect-wallet"
import { Hexagon } from "lucide-react"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <a href="/" className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center border border-border bg-card text-primary">
            <Hexagon className="size-4" />
          </div>
          <div className="font-heading text-lg tracking-[-1.5px] font-bold">NORMIES<span className="text-primary">CREDHUB</span></div>
        </a>
        <ConnectWallet />
      </div>
    </header>
  )
}
