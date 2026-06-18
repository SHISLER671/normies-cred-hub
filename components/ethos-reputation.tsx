"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getEthosLevelMeta, getEthosScorePercent } from "@/lib/ethos-levels"
import { shortenAddress } from "@/lib/format"
import type { EthosScoreResult } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ExternalLink, ShieldCheck, ThumbsUp, TrendingUp, Users } from "lucide-react"

function ScoreArc({ score }: { score: number }) {
  const pct = getEthosScorePercent(score)
  const meta = getEthosLevelMeta(getEthosLevelFromScore(score))
  // semi-circular gauge
  const radius = 70
  const circumference = Math.PI * radius
  const offset = circumference - (pct / 100) * circumference

  return (
    <div className="relative flex flex-col items-center">
      <svg width="180" height="104" viewBox="0 0 180 104" className="overflow-visible">
        <path
          d="M 20 96 A 70 70 0 0 1 160 96"
          fill="none"
          stroke="var(--border)"
          strokeWidth="10"
        />
        <path
          d="M 20 96 A 70 70 0 0 1 160 96"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
        <span className="font-heading text-5xl font-bold tabular-nums tracking-[-2px]">{score}</span>
        <span className="text-[10px] text-muted-foreground">/ 2800</span>
      </div>
      <span className="sr-only">{`Credibility score ${score} — ${meta.level}`}</span>
    </div>
  )
}

// local import-free helper to avoid circular concerns
function getEthosLevelFromScore(score: number) {
  if (score <= 799) return "Untrusted" as const
  if (score <= 1199) return "Questionable" as const
  if (score <= 1599) return "Neutral" as const
  if (score <= 1999) return "Reputable" as const
  if (score <= 2399) return "Exemplary" as const
  return "Revered" as const
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string | number
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-3">
      <Icon className="size-3.5 text-muted-foreground" aria-hidden />
      <div className="flex flex-col leading-none text-sm">
        <span className="font-medium data tabular-nums">{value}</span>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      </div>
    </div>
  )
}

export function EthosReputation({
  result,
  isLoading,
  error,
  address,
  isMyAgent = false,
}: {
  result?: EthosScoreResult
  isLoading?: boolean
  error?: boolean
  address: string
  isMyAgent?: boolean
}) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-widest">
            <ShieldCheck className="size-4" /> {isMyAgent ? "YOUR ETHOS" : "ETHOS"}
          </CardTitle>
          <div className="text-[10px] text-muted-foreground">BASE</div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4">
        {isLoading ? (
          <div className="flex flex-col items-center gap-4">
            <Skeleton className="h-[104px] w-[180px] rounded-lg" />
            <Skeleton className="h-7 w-28" />
            <div className="grid w-full grid-cols-2 gap-2">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          </div>
        ) : error || !result?.found || !result.user ? (
          <EthosFallback address={address} />
        ) : (
          <EthosContent result={result} />
        )}
      </CardContent>
    </Card>
  )
}

function EthosContent({ result }: { result: EthosScoreResult }) {
  const user = result.user!
  const meta = getEthosLevelMeta(result.level ?? "Neutral")
  const reviews = user.stats?.review?.received
  const vouches = user.stats?.vouch?.received?.count ?? 0

  return (
    <>
      <div className="flex flex-col items-center gap-2">
        {user.username && (
          <div className="text-primary font-bold">@ {user.username}</div>
        )}
        {user.displayName && !user.username && (
          <div className="text-primary font-bold">{user.displayName}</div>
        )}
        <ScoreArc score={user.score} />
        <div className={cn("border px-3 py-0.5 text-sm font-bold tracking-[1px]", meta.className)}>
          {meta.level.toUpperCase()}
        </div>
        <p className="max-w-[220px] text-center text-xs leading-snug text-muted-foreground">
          {meta.description}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-1">
        <Stat icon={TrendingUp} label="XP" value={user.xpTotal.toLocaleString()} />
        <Stat icon={Users} label="INFLUENCE" value={`${Math.round(user.influenceFactor)}`} />
        <Stat icon={ThumbsUp} label="REVIEWS" value={reviews?.positive ?? 0} />
        <Stat icon={ShieldCheck} label="VOUCHES" value={vouches} />
      </div>

      <a
        href={user.username ? `https://app.ethos.network/profile/x/${user.username}` : user.links.scoreBreakdown}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-auto inline-flex items-center justify-center gap-1 border border-border bg-card px-3 py-2 text-xs uppercase tracking-widest hover:bg-primary hover:text-background"
      >
        {user.username ? 'VIEW ON ETHOS' : 'FULL BREAKDOWN'} <ExternalLink className="size-3" />
      </a>
    </>
  )
}

function EthosFallback({ address }: { address: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-6 text-center">
      <ShieldCheck className="size-5 text-muted-foreground" />
      <div>
        <div className="font-bold">SCORE UNAVAILABLE</div>
        <div className="text-xs text-muted-foreground mt-1">COULD NOT LOAD ETHOS DATA</div>
      </div>
      <a
        href={`https://app.ethos.network/profile/x/${address}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs uppercase tracking-widest text-primary hover:underline"
      >
        VIEW ON ETHOS
      </a>
    </div>
  )
}
