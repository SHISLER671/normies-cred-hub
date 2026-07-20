import Link from "next/link"

import { ZULO_IDENTITY } from "@/lib/agent-recommendations"
import { cn } from "@/lib/utils"

type ZuloChromeHeaderProps = {
  active?: "home" | "ask" | "dashboard"
  className?: string
  trailing?: React.ReactNode
  fixed?: boolean
}

export function ZuloChromeHeader({
  active,
  className,
  trailing,
  fixed = true,
}: ZuloChromeHeaderProps) {
  return (
    <header className={cn("header", fixed && "header-fixed", className)}>
      <Link href="/" className="header-logo">
        ZULO
      </Link>
      <nav className="header-nav">
        <Link href="/ask" className={cn(active === "ask" && "is-active")}>
          Ask
        </Link>
        <Link href="/dashboard" className={cn(active === "dashboard" && "is-active")}>
          Dashboard
        </Link>
        <a
          href={`https://www.normies.art/lab/agentic/agents/${ZULO_IDENTITY.agentId}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          View on Normies →
        </a>
        {trailing}
      </nav>
    </header>
  )
}
