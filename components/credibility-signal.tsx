import type { CredibilitySignal as CredibilitySignalData } from "@/lib/types"
import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

/**
 * Renders a single Credibility Framework stage from a normalized signal.
 * Matches existing squared, minimal-border visual rhythm.
 */
export function CredibilitySignal({
  signal,
  icon: Icon,
  children,
}: {
  signal: CredibilitySignalData
  icon: LucideIcon
  children: ReactNode
}) {
  return (
    <div
      className="cred-stage"
      data-signal-id={signal.id}
      data-signal-source={signal.source}
      data-signal-category={signal.category}
    >
      <div>
        <div className="flex h-8 w-8 items-center justify-center rounded-none border border-primary bg-primary/10">
          <Icon className="size-4 text-primary" />
        </div>
      </div>
      <div className="cred-content">
        <h3 className="font-heading text-base font-semibold leading-snug mb-1.5">{signal.title}</h3>
        {signal.description ? (
          <p className="text-sm leading-relaxed text-muted-foreground mb-3 max-w-prose text-pretty">{signal.description}</p>
        ) : null}
        <div className="cred-data">{children}</div>
      </div>
    </div>
  )
}

export function CredibilityConnector() {
  return <div className="cred-connector h-4" />
}
