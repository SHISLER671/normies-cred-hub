"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { SectionLabel } from "@/components/ui/section-label"
import { Skeleton } from "@/components/ui/skeleton"
import { ZULO } from "@/constants/contracts"
import { etherscanAddress, shortenAddress } from "@/lib/format"
import { ExternalLink, Quote, Sparkles } from "lucide-react"

export function AgentCard({
  snapshot,
  isLoading,
  isMyAgent = false,
  ownerEthosUsername,
  delegateAddress,
  delegateEnsName,
}: {
  snapshot?: any
  isLoading?: boolean
  isMyAgent?: boolean
  ownerEthosUsername?: string | null
  delegateAddress?: string
  delegateEnsName?: string | null
}) {
  if (isLoading || !snapshot) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="flex flex-col gap-6 p-6 sm:flex-row">
          <Skeleton className="aspect-square w-full shrink-0 sm:w-[180px]" />
          <div className="flex w-full flex-col gap-4">
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-16 w-full" />
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-20" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const agentName = snapshot.agent?.name || "Agent"
  const tokenId = snapshot.token?.tokenId || snapshot.tokenId || "?"

  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col gap-6 p-6 sm:flex-row">
        <div className="relative mx-auto w-full max-w-[180px] shrink-0 sm:mx-0 sm:w-[180px]">
          <div className={`overflow-hidden border bg-card ${isMyAgent ? "border-primary" : "border-border/60"}`}>
            <img
              src={snapshot.imageUrl || snapshot.token?.image || "/placeholder.svg"}
              alt={`${agentName} pixel portrait`}
              className="aspect-square w-full pixel-frame transition-transform hover:scale-[1.015]"
              crossOrigin="anonymous"
            />
          </div>
          <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 border px-3 py-px text-[10px] font-bold tracking-[2px] ${isMyAgent ? "border-primary bg-primary text-background" : "border-primary bg-background text-primary"}`}>
            {isMyAgent ? "YOURS" : "AWAKENED"}
          </div>
        </div>

        <div className="flex w-full flex-col gap-5">
          <div>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="font-heading text-4xl tracking-[-2px]">
                {isMyAgent ? "YOUR" : ""} {agentName}
              </h2>
              <span className="font-mono text-xl text-muted-foreground">#{tokenId}</span>
            </div>
            <SectionLabel>
              {isMyAgent ? "Your Awakened Agent" : `Normie #${tokenId} • ERC-8004`}
            </SectionLabel>
            {ownerEthosUsername && (
              <a href={`https://app.ethos.network/profile/x/${ownerEthosUsername}`} target="_blank" className="text-primary text-xs hover:underline">
                @ {ownerEthosUsername} on Ethos
              </a>
            )}
            {isMyAgent && delegateAddress && (
              <SectionLabel className="mt-0.5">
                via delegated hot wallet{delegateEnsName ? ` + ${delegateEnsName}` : ""}
              </SectionLabel>
            )}
          </div>

          <blockquote className="border-l-2 border-primary/70 pl-4 text-sm leading-tight text-foreground/90">
            {isMyAgent && <SectionLabel className="text-primary mb-1">Your Agent Says</SectionLabel>}
            {snapshot.agent?.tagline || "An awakened identity on the Normies network."}
          </blockquote>

          <div className="flex flex-wrap gap-1">
            {snapshot.traits?.attributes?.slice(0, 8).map((t: any, i: number) => (
              <div key={i} className="bg-secondary/60 px-2 py-px text-[10px] tracking-[1.5px] text-muted-foreground">
                {t.trait_type}: <span className="text-foreground">{t.value}</span>
              </div>
            ))}
            {/* Trait Gate awareness badge */}
            {snapshot.traits?.attributes?.some((t: any) => t.trait_type === "Type" && t.value === "Agent") && (
              <div className="bg-emerald-500/10 px-2 py-px text-[10px] tracking-[1.5px] text-emerald-400">Agent Gate</div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
