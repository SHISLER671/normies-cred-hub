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
          stroke="var(--color-muted)"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M 20 96 A 70 70 0 0 1 160 96"
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
        <span className="font-heading text-4xl font-bold tabular-nums">{score}</span>
        <span className="text-xs text-muted-foreground">of 2800</span>
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
    <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2">
      <Icon className="size-4 text-muted-foreground" aria-hidden />
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-medium tabular-nums">{value}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
    </div>
  )
}

export function EthosReputation({
  result,
  isLoading,
  error,
  address,
}: {
  result?: EthosScoreResult
  isLoading?: boolean
  error?: boolean
  address: string
}) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            Ethos Reputation
          </CardTitle>
          <Badge variant="outline" className="font-mono text-xs">
            on Base
          </Badge>
        </div>
        <CardDescription>
          Credibility for the agent owner {shortenAddress(address)}
        </CardDescription>
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
        <ScoreArc score={user.score} />
        <Badge className={cn("border px-3 py-1 text-sm font-semibold", meta.className)}>
          {meta.level}
        </Badge>
        <p className="max-w-xs text-center text-xs text-muted-foreground text-pretty">
          {meta.description}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat icon={TrendingUp} label="XP Total" value={user.xpTotal.toLocaleString()} />
        <Stat icon={Users} label="Influence" value={`${Math.round(user.influenceFactor)}`} />
        <Stat
          icon={ThumbsUp}
          label="Positive Reviews"
          value={reviews?.positive ?? 0}
        />
        <Stat icon={ShieldCheck} label="Vouches" value={vouches} />
      </div>

      <a
        href={user.links.scoreBreakdown}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm text-foreground transition-colors hover:border-primary/50 hover:text-primary"
      >
        View full breakdown on Ethos
        <ExternalLink className="size-3.5" />
      </a>
    </>
  )
}

function EthosFallback({ address }: { address: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-6 text-center">
      <div className="rounded-full bg-muted p-3">
        <ShieldCheck className="size-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">Score unavailable</p>
      <p className="max-w-xs text-xs text-muted-foreground text-pretty">
        We could not load an Ethos credibility score for this address right now.
      </p>
      <a
        href={`https://app.ethos.network/profile/${address}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
      >
        View on app.ethos.network
        <ExternalLink className="size-3.5" />
      </a>
    </div>
  )
}
