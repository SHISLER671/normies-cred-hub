"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ERC8004 } from "@/constants/contracts"
import { etherscanAddress, shortenAddress } from "@/lib/format"
import { useErc8004 } from "@/hooks/use-erc8004"
import { Boxes, CircleCheck, Clock, ExternalLink } from "lucide-react"

export function Erc8004Card({ agentId }: { agentId: number }) {
  const { agentURI, registeredOwner, isLoading, isError, verified } = useErc8004(agentId)

  const isRegistered = verified && (agentURI || registeredOwner)

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Boxes className="size-5 text-primary" />
            ERC-8004 Identity
          </CardTitle>
          <Badge variant="outline" className="font-mono text-xs">
            Ethereum
          </Badge>
        </div>
        <CardDescription>On-chain trustless agent registration</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4 text-sm">
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : isRegistered ? (
          <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-5">
            <div className="flex items-center gap-3">
              <CircleCheck className="size-6 text-green-400" />
              <div>
                <p className="font-medium text-green-400">Registered On-Chain</p>
                <p className="text-xs text-green-400/80">Agent #{agentId} is officially recognized</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
            <div className="flex items-center gap-3">
              <Clock className="size-6 text-amber-400" />
              <div>
                <p className="font-medium">On-Chain Status Pending</p>
                <p className="text-xs text-amber-400/80 mt-1">
                  Zulo is confirmed active via Normies API + OpenSea.<br />
                  The registry read is not returning data yet for this agent.
                </p>
                <p className="text-xs text-amber-400/80 mt-2">
                  This is common for some awakened agents even after weeks.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-auto text-xs text-muted-foreground">
          Registry Contract:{" "}
          <a 
            href={etherscanAddress(ERC8004.IDENTITY_REGISTRY)} 
            target="_blank" 
            className="hover:text-primary font-mono"
          >
            {shortenAddress(ERC8004.IDENTITY_REGISTRY)}
          </a>
        </div>
      </CardContent>
    </Card>
  )
}
