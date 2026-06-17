"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ERC8004 } from "@/constants/contracts"
import { etherscanAddress, shortenAddress } from "@/lib/format"
import { useErc8004 } from "@/hooks/use-erc8004"
import { Boxes, CircleCheck, Clock, ExternalLink } from "lucide-react"

export function Erc8004Card({ agentId, isMyAgent = false }: { agentId: number; isMyAgent?: boolean }) {
  const { agentURI, registeredOwner, isLoading, isError, verified } = useErc8004(agentId)

  const isRegistered = verified && (agentURI || registeredOwner)

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-widest">
          <Boxes className="size-4" /> {isMyAgent ? "YOUR ON-CHAIN IDENTITY" : "ERC-8004"}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4 text-sm">
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : isRegistered ? (
          <div className="border border-emerald-500/30 bg-card px-4 py-4">
            <div className="flex items-center gap-3">
              <CircleCheck className="size-4 text-emerald-400" />
              <div>
                <div className="font-bold text-emerald-400">REGISTERED ON-CHAIN</div>
                <div className="text-xs text-emerald-400/70">AGENT #{agentId} • OFFICIALLY RECOGNIZED</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="border border-amber-500/30 bg-card px-4 py-4">
            <div className="flex items-center gap-3">
              <Clock className="size-4 text-amber-400" />
              <div>
                <div className="font-bold text-amber-400">PENDING ON-CHAIN</div>
                <div className="text-xs text-amber-400/70 mt-0.5 leading-tight">LIVE ON NORMIES + OPENSEA.<br />REGISTRY LAG IS COMMON.</div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-auto text-[10px] uppercase tracking-widest text-muted-foreground">
          REGISTRY <a href={etherscanAddress(ERC8004.IDENTITY_REGISTRY)} target="_blank" className="font-mono hover:text-primary">{shortenAddress(ERC8004.IDENTITY_REGISTRY)}</a>
        </div>
      </CardContent>
    </Card>
  )
}
