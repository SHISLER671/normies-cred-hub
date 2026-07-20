import Link from "next/link"

import { ZULO_IDENTITY } from "@/lib/agent-recommendations"
import { cn } from "@/lib/utils"

type ZuloChromeHeaderProps = {
  active?: "home" | "ask" | "dashboard"
  className?: string
  /** Right-side slot (e.g. wallet controls on /ask) */
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
    <header
      className={cn(
        "z-50 border-b border-[#1f1f1f] bg-[#0a0a0a]/90 backdrop-blur",
        fixed ? "fixed left-0 right-0 top-0" : "sticky top-0",
        className,
      )}
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link href="/" className="font-bold tracking-tight text-[#f5f5f5]">
          ZULO
        </Link>
        <nav className="flex flex-wrap items-center gap-4 text-sm sm:gap-6">
          <Link
            href="/ask"
            className={cn(
              "transition-colors hover:text-[#f5f5f5]",
              active === "ask" ? "text-[#f5f5f5]" : "text-[#a3a3a3]",
            )}
          >
            Ask
          </Link>
          <Link
            href="/dashboard"
            className={cn(
              "transition-colors hover:text-[#f5f5f5]",
              active === "dashboard" ? "text-[#f5f5f5]" : "text-[#a3a3a3]",
            )}
          >
            Dashboard
          </Link>
          <a
            href={`https://www.normies.art/lab/agentic/agents/${ZULO_IDENTITY.agentId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#a3a3a3] transition-colors hover:text-[#f5f5f5]"
          >
            View on Normies →
          </a>
          {trailing}
        </nav>
      </div>
    </header>
  )
}
