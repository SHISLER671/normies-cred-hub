"use client"

import Link from "next/link"

import { ConnectWallet } from "@/components/connect-wallet"
import { ThemeToggle } from "@/components/theme-toggle"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/90">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-4 sm:gap-6">
          <Link href="/" className="flex shrink-0 items-center gap-3 group">
            <img
              src="/images/NLOGO.png"
              alt="Normies"
              className="h-8 w-8 object-contain"
            />
            <div className="font-heading text-xl tracking-[-1.8px] font-semibold">
              NORMIES <span className="text-primary tracking-[-1.2px]">CREDHUB</span>
            </div>
          </Link>
          <nav className="hidden items-center gap-4 text-sm sm:flex">
            <Link
              href="/"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Zulo
            </Link>
            <Link
              href="/ask"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Ask
            </Link>
            <Link href="/dashboard" className="font-medium text-foreground">
              Dashboard
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <ConnectWallet />
        </div>
      </div>
    </header>
  )
}
