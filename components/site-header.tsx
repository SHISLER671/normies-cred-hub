"use client"

import { Boxes } from "lucide-react"
import { ConnectWallet } from "@/components/connect-wallet"
import { ThemeToggle } from "@/components/theme-toggle"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/90">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
        <a href="/" className="flex items-center gap-3 group">
          <div className="flex size-8 items-center justify-center border border-border bg-card rounded-none transition-colors group-hover:border-primary text-primary">
            <Boxes className="size-[18px]" aria-hidden="true" />
          </div>
          <div className="font-heading text-xl tracking-[-1.8px] font-semibold">
            NORMIES <span className="text-primary tracking-[-1.2px]">CREDHUB</span>
          </div>
        </a>

        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <ConnectWallet />
        </div>
      </div>
    </header>
  )
}
