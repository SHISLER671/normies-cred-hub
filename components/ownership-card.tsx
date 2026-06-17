"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { etherscanAddress, shortenAddress } from "@/lib/format"
import type { NormieSnapshot } from "@/lib/types"
import { ExternalLink, Layers, Palette, Wallet } from "lucide-react"

export function OwnershipCard({
  snapshot,
  isLoading,
  isMyAgent = false,
}: {
  snapshot?: NormieSnapshot
  isLoading?: boolean
  isMyAgent?: boolean
}) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-widest">
          <Layers className="size-4" /> {isMyAgent ? "YOUR OWNERSHIP &amp; CANVAS" : "OWNERSHIP &amp; CANVAS"}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3 text-sm">
        {isLoading || !snapshot ? (
          <>
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 px-3 py-2.5">
              <Wallet className="size-4 shrink-0 text-muted-foreground" />
              <div className="flex flex-1 flex-col leading-tight text-sm">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">OWNER</div>
                <a
                  href={etherscanAddress(snapshot.owner.owner)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-foreground hover:text-primary"
                >
                  {shortenAddress(snapshot.owner.owner, 6)}
                </a>
              </div>
            </div>

            <div className="flex items-center gap-3 px-3 py-2.5">
              <Palette className="size-4 shrink-0 text-muted-foreground" />
              <div className="flex flex-1 flex-col leading-tight text-sm">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">CANVAS</div>
                <div>LVL {snapshot.canvas.level} • {snapshot.canvas.actionPoints} AP</div>
              </div>
              <div className="border px-1.5 py-px text-[10px] tracking-widest">
                {snapshot.canvas.customized ? "CUSTOM" : "PRISTINE"}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1 text-center text-sm">
              <Metric label="ADDED" value={`+${snapshot.canvasDiff.addedCount}`} />
              <Metric label="REMOVED" value={`-${snapshot.canvasDiff.removedCount}`} />
              <Metric label="NET" value={`${snapshot.canvasDiff.netChange}`} />
            </div>

            {snapshot.canvas.delegate &&
              snapshot.canvas.delegate !== "0x0000000000000000000000000000000000000000" && (
                <div className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">DELEGATE</span>
                  <span className="font-mono">{shortenAddress(snapshot.canvas.delegate)}</span>
                </div>
              )}

            <p className="mt-auto pt-2 text-[10px] text-muted-foreground">
              {isMyAgent ? "YOUR PIXELS. YOUR PROOF. YOUR AGENT." : "LIVE NORMIES REGISTRY. PIXEL CANVAS BY THE PEOPLE."}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center py-2.5">
      <span className="font-heading text-lg font-bold tabular-nums tracking-[-1px]">{value}</span>
      <span className="text-[10px] uppercase tracking-[2px] text-muted-foreground">{label}</span>
    </div>
  )
}
