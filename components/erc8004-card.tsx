"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SectionLabel } from "@/components/ui/section-label"
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
      <CardContent className="flex flex-1 flex-col gap-4 text-sm">
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : isRegistered ? (
          <div className="px-1">
            <div className="flex items-center gap-2 text-emerald-400">
              <CircleCheck className="size-4" />
              <span className="font-medium">Registered on-chain</span>
            </div>
            <div className="text-sm text-emerald-400/70 ml-6">Agent #{agentId} recognized</div>
          </div>
        ) : (
          <div className="px-1">
            <div className="flex items-center gap-2 text-amber-400">
              <Clock className="size-4" />
              <span className="font-medium">On-chain status pending</span>
            </div>
            <div className="text-sm text-amber-400/70 ml-6">Live on Normies + OpenSea. Registry data often lags.</div>
          </div>
        )}

        <div className="mt-auto text-sm text-muted-foreground">
          Registry: <a href={etherscanAddress(ERC8004.IDENTITY_REGISTRY)} target="_blank" className="font-mono hover:text-primary underline">{shortenAddress(ERC8004.IDENTITY_REGISTRY)}</a>
        </div>
      </CardContent>
    </Card>
  )
}
