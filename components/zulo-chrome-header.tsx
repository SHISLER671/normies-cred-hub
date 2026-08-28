import Image from "next/image"
import Link from "next/link"

import { ActiveNormieSwitcher } from "@/components/active-normie-switcher"
import { ThemeToggle } from "@/components/theme-toggle"
import { ZuloMotionRoot } from "@/components/zulo-motion-root"
import { ZULO_IDENTITY } from "@/lib/agent-recommendations/constants"
import { cn } from "@/lib/utils"

type ZuloChromeHeaderProps = {
  active?: "home" | "ask" | "paths" | "moves" | "dashboard"
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
      <nav className="header-nav" aria-label="Primary">
        <Link
          href="/dashboard"
          className={cn(active === "dashboard" && "is-active")}
        >
          PULSE
        </Link>
        <Link href="/ask" className={cn(active === "ask" && "is-active")}>
          Ask
        </Link>
        <Link href="/paths" className={cn(movesActive && "is-active")}>
          Moves
        </Link>
        <a
          href={`https://www.normies.art/lab/agentic/agents/${ZULO_IDENTITY.agentId}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          View on Normies →
        </a>
        {showActiveNormie ? <ActiveNormieSwitcher /> : null}
        <ThemeToggle />
        {trailing}
      </nav>
    </header>
  )
}
