"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ZULO } from "@/constants/contracts"
import { etherscanAddress, shortenAddress } from "@/lib/format"
import { ExternalLink, Quote, Sparkles } from "lucide-react"

export function AgentCard({
  snapshot,
  isLoading,
}: {
  snapshot?: any
  isLoading?: boolean
}) {
  if (isLoading || !snapshot) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="flex flex-col gap-6 p-6 sm:flex-row">
          <Skeleton className="aspect-square w-full shrink-0 rounded-xl sm:w-48" />
          <div className="flex w-full flex-col gap-3">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-20 w-full" />
            <div className="flex flex-wrap gap-2">
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
        <div className="relative mx-auto w-full max-w-[12rem] shrink-0 sm:mx-0 sm:w-48">
          <div className="overflow-hidden rounded-xl border border-border bg-secondary">
            <img
              src={snapshot.imageUrl || snapshot.token?.image || "/placeholder.svg"}
              alt={`${agentName} pixel portrait`}
              className="aspect-square w-full"
              crossOrigin="anonymous"
            />
          </div>
          <Badge className="absolute -bottom-2 left-1/2 -translate-x-1/2 gap-1 bg-primary text-primary-foreground shadow-lg">
            <Sparkles className="size-3" />
            Awakened Agent
          </Badge>
        </div>

        <div className="flex w-full flex-col gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-heading text-3xl font-bold tracking-tight text-balance">
                {agentName}
              </h2>
              <Badge variant="secondary" className="font-mono">
                #{tokenId}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Normie #{tokenId} · ERC-8004 Agent
            </p>
          </div>

          <blockquote className="flex gap-2 rounded-lg border border-border bg-secondary/40 p-3 text-sm italic text-foreground/90">
            <Quote className="size-4 shrink-0 text-primary" aria-hidden />
            <span className="text-pretty">{snapshot.agent?.tagline || "An awakened identity on the Normies network."}</span>
          </blockquote>

          <div className="flex flex-wrap gap-2">
            {snapshot.traits?.attributes?.slice(0, 8).map((t: any, i: number) => (
              <Badge key={i} variant="outline" className="font-normal text-xs">
                <span className="text-muted-foreground">{t.trait_type}:</span>{" "}
                <span className="text-foreground">{t.value}</span>
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
