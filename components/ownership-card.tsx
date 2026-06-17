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
}: {
  snapshot?: NormieSnapshot
  isLoading?: boolean
}) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="size-5 text-primary" />
          Ownership &amp; Canvas
        </CardTitle>
        <CardDescription>Provenance and on-chain customization state</CardDescription>
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
            <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
              <Wallet className="size-5 shrink-0 text-muted-foreground" />
              <div className="flex flex-1 flex-col leading-tight">
                <span className="text-xs text-muted-foreground">Current Owner</span>
                <a
                  href={etherscanAddress(snapshot.owner.owner)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-foreground hover:text-primary"
                >
                  {shortenAddress(snapshot.owner.owner, 6)}
                  <ExternalLink className="size-3" />
                </a>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
              <Palette className="size-5 shrink-0 text-muted-foreground" />
              <div className="flex flex-1 flex-col leading-tight">
                <span className="text-xs text-muted-foreground">Canvas</span>
                <span className="font-medium">
                  Level {snapshot.canvas.level} · {snapshot.canvas.actionPoints} AP
                </span>
              </div>
              <Badge
                variant={snapshot.canvas.customized ? "default" : "secondary"}
                className="shrink-0"
              >
                {snapshot.canvas.customized ? "Customized" : "Pristine"}
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Metric label="Added" value={`+${snapshot.canvasDiff.addedCount}`} />
              <Metric label="Removed" value={`-${snapshot.canvasDiff.removedCount}`} />
              <Metric label="Net" value={`${snapshot.canvasDiff.netChange}`} />
            </div>

            {snapshot.canvas.delegate &&
              snapshot.canvas.delegate !== "0x0000000000000000000000000000000000000000" && (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2">
                  <span className="text-muted-foreground">Canvas Delegate</span>
                  <span className="font-mono text-foreground">
                    {shortenAddress(snapshot.canvas.delegate)}
                  </span>
                </div>
              )}

            <p className="mt-auto pt-1 text-xs text-muted-foreground text-pretty">
              Ownership reflects the live Normies registry. Canvas tracks community pixel-art
              customization for this token.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-border bg-secondary/30 py-2">
      <span className="font-heading text-lg font-bold tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}
