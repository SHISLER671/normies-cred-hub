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
        <div className="font-medium mb-1">{signal.title}</div>
        {signal.description ? (
          <p className="text-sm text-muted-foreground mb-2">{signal.description}</p>
        ) : null}
        <div className="cred-data">{children}</div>
      </div>
    </div>
  )
}

export function CredibilityConnector() {
  return <div className="cred-connector h-4" />
}