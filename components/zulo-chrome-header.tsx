import Image from "next/image"
import Link from "next/link"

import { ActiveNormieSwitcher } from "@/components/active-normie-switcher"
import { HeaderMenuToggle } from "@/components/header-menu-toggle"
import { ThemeToggle } from "@/components/theme-toggle"
import { ZuloMotionRoot } from "@/components/zulo-motion-root"
import { ZULO_IDENTITY } from "@/lib/agent-recommendations/constants"
import { cn } from "@/lib/utils"

type ZuloChromeHeaderProps = {
  active?: "home" | "ask" | "paths" | "moves" | "dashboard" | "burn" | "pixels" | "symphony"
  className?: string
  trailing?: React.ReactNode
  fixed?: boolean
  /** Show Active Normie switcher (default true). */
  showActiveNormie?: boolean
}

export function ZuloChromeHeader({
  active,
  className,
  trailing,
  fixed = true,
  showActiveNormie = true,
}: ZuloChromeHeaderProps) {
  const movesActive = active === "paths" || active === "moves"

  return (
    <header className={cn("header", fixed && "header-fixed", className)}>
      {/* Product-wide motion: scroll reveal, header state, desktop cursor ring */}
      <ZuloMotionRoot />
      <Link href="/" className="header-brand">
        <Image
          src="/images/NLOGO.png"
          alt="Normies"
          width={36}
          height={36}
          className="header-brand-logo"
          priority
        />
        <span className="header-brand-text">
          NORMIES <span className="header-brand-accent">CREDHUB</span>
        </span>
      </Link>
      <HeaderMenuToggle navId="site-nav" />
      <nav id="site-nav" className="header-nav" aria-label="Primary">
        {/* A to Z (Ryan, 2026-10-20); the landing page's tool cells use the same names and order. */}
        <Link
          href="/ask"
          className={cn("nav-ask", active === "ask" && "is-active")}
        >
          Ask
        </Link>
        <Link href="/burn" className={cn(active === "burn" && "is-active")}>
          Burn
        </Link>
        <Link href="/paths" className={cn(movesActive && "is-active")}>
          Moves
        </Link>
        <Link href="/pixels" className={cn(active === "pixels" && "is-active")}>
          Pixels
        </Link>
        <Link
          href="/dashboard"
          className={cn(active === "dashboard" && "is-active")}
        >
          Pulse
        </Link>
        <Link href="/symphony" className={cn(active === "symphony" && "is-active")}>
          Symphony
        </Link>
        <a
          href={`https://www.normies.art/lab/agentic/agents/${ZULO_IDENTITY.agentId}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Zulo's agent page on normies.art (opens in a new tab)"
        >
          <span className="nav-ext-who">Zulo on&nbsp;</span>normies.art ↗
        </a>
        {showActiveNormie ? <ActiveNormieSwitcher /> : null}
        <ThemeToggle />
        {trailing}
      </nav>
    </header>
  )
}
