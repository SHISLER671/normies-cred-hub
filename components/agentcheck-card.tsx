"use client"

import { SectionLabel } from "@/components/ui/section-label"
import { Skeleton } from "@/components/ui/skeleton"
import type { AgentCheckResult } from "@/lib/types"
import { cn } from "@/lib/utils"
import { AlertTriangle, BadgeCheck, CircleCheck, ExternalLink, ShieldQuestion } from "lucide-react"

/** Maps an S&P-style AgentCheck grade to a tone + token-based badge classes. */
function getRatingMeta(rating?: string) {
  const r = (rating ?? "").toUpperCase()
  if (/^A/.test(r)) {
    return { tone: "Strong", className: "bg-primary/15 text-primary border-primary/30" }
  }
  if (/^B/.test(r)) {
    return { tone: "Stable", className: "bg-secondary text-foreground border-border" }
  }
  if (/^C/.test(r)) {
    return { tone: "Caution", className: "bg-destructive/10 text-destructive border-destructive/25" }
  }
  if (r) {
    return { tone: "High Risk", className: "bg-destructive/20 text-destructive border-destructive/40" }
  }
  return { tone: "Unrated", className: "bg-muted text-muted-foreground border-border" }
}

function ScoreBar({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <SectionLabel>{label}</SectionLabel>
        <span className="font-medium tabular-nums">{pct}</span>
      </div>
      <div className="mt-1 h-1.5 w-full bg-muted">
        <div
          className={cn("h-full transition-[width] duration-700", danger ? "bg-destructive" : "bg-primary")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function AgentCheckCard({
  result,
  isLoading,
  address,
}: {
  result?: AgentCheckResult | null
  isLoading?: boolean
  address?: string
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  if (!result || !result.rating) {
    return (
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <ShieldQuestion className="size-5 text-muted-foreground" aria-hidden />
        <div className="text-sm font-medium">No trust rating available</div>
        <div className="text-xs text-muted-foreground">AgentCheck has no data for this wallet yet.</div>
      </div>
    )
  }

  const meta = getRatingMeta(result.rating)
  const highlights = result.report?.highlights?.slice(0, 3) ?? []
  const riskFlags = result.report?.risk_flags ?? []
  const verified = result.address_type?.verified

  return (
    <div className="space-y-4">
      {/* Rating headline */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <SectionLabel>TRUST RATING</SectionLabel>
          <div className="flex items-center gap-2">
            <span className="font-heading text-3xl font-bold tabular-nums tracking-tight">{result.rating}</span>
            {result.outlook && (
              <span className="text-xs text-muted-foreground">{result.outlook} outlook</span>
            )}
          </div>
        </div>
        <div className={cn("border px-2.5 py-1 text-xs font-bold tracking-[1px]", meta.className)}>
          {meta.tone.toUpperCase()}
        </div>
      </div>

      {verified && (
        <div className="flex items-center gap-1.5 text-xs text-primary">
          <BadgeCheck className="size-4" aria-hidden />
          <span className="font-medium">
            Verified{result.address_type?.label ? `: ${result.address_type.label}` : ""}
          </span>
        </div>
      )}

      {/* Trust / risk scores */}
      <div className="space-y-2.5">
        {typeof result.trust_score === "number" && <ScoreBar label="TRUST" value={result.trust_score} />}
        {typeof result.risk_score === "number" && <ScoreBar label="RISK" value={result.risk_score} danger />}
      </div>

      {/* Verdict */}
      {result.verdict && (
        <p className="text-sm leading-snug text-muted-foreground">{result.verdict}</p>
      )}

      {/* Highlights */}
      {highlights.length > 0 && (
        <ul className="space-y-1.5">
          {highlights.map((h, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <CircleCheck className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
              <span>{h}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Risk flags */}
      {riskFlags.length > 0 && (
        <ul className="space-y-1.5">
          {riskFlags.map((f, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      )}

      {address && (
        <a
          href={`/api/agentcheck?wallet=${address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-full items-center justify-center gap-1 border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-primary hover:text-primary-foreground hover:border-primary"
        >
          View raw report <ExternalLink className="size-3" />
        </a>
      )}
    </div>
  )
}
