"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SectionLabel } from "@/components/ui/section-label"
import { Skeleton } from "@/components/ui/skeleton"
import { ensAppUrl, etherscanAddress, shortenAddress } from "@/lib/format"
import type { NormieSnapshot } from "@/lib/types"
import { ExternalLink, Layers, Palette, Wallet } from "lucide-react"

export function OwnershipCard({
  snapshot,
  isLoading,
  isMyAgent = false,
  ownerEthosUsername,
  delegateAddress,
  delegateEnsName,
  isDelegateController = false,
}: {
  snapshot?: NormieSnapshot
  isLoading?: boolean
  isMyAgent?: boolean
  ownerEthosUsername?: string | null
  delegateAddress?: string
  delegateEnsName?: string | null
  isDelegateController?: boolean
}) {
  const isZeroAddrLocal = (a?: string | null) =>
    !a || a === "0x0000000000000000000000000000000000000000"

  return (
    <Card className="flex h-full flex-col">
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
                <SectionLabel>Owner</SectionLabel>
                <a
                  href={etherscanAddress(snapshot.owner.owner)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-foreground hover:text-primary"
                >
                  {shortenAddress(snapshot.owner.owner, 6)}
                </a>
                {ownerEthosUsername && (
                  <a href={`https://app.ethos.network/profile/x/${ownerEthosUsername}`} target="_blank" className="text-primary text-xs hover:underline">
                    @{ownerEthosUsername}
                  </a>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 px-3 py-2.5">
              <Palette className="size-4 shrink-0 text-muted-foreground" />
              <div className="flex flex-1 flex-col leading-tight text-sm">
                <SectionLabel>Canvas</SectionLabel>
                <div>LVL {snapshot.canvas.level} • {snapshot.canvas.actionPoints} AP</div>
              </div>
              <div className="border px-1.5 py-px text-[10px] tracking-[1.5px]">
                {snapshot.canvas.customized ? "CUSTOM" : "PRISTINE"}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1 text-center text-sm">
              <Metric label="ADDED" value={`+${snapshot.canvasDiff.addedCount}`} />
              <Metric label="REMOVED" value={`-${snapshot.canvasDiff.removedCount}`} />
              <Metric label="NET" value={`${snapshot.canvasDiff.netChange}`} />
            </div>

            {delegateAddress && !isZeroAddrLocal(delegateAddress) ? (
              <div className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="text-muted-foreground">DELEGATE</span>
                <a
                  href={etherscanAddress(delegateAddress)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-foreground hover:text-primary"
                >
                  {shortenAddress(delegateAddress)}
                </a>
                {delegateEnsName && (
                  <span className="text-primary text-xs font-mono">{delegateEnsName}</span>
                )}
              </div>
            ) : snapshot.canvas.delegate &&
              snapshot.canvas.delegate !== "0x0000000000000000000000000000000000000000" && (
                // Fallback for direct snapshot if props not passed
                <div className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">DELEGATE</span>
                  <a
                    href={etherscanAddress(snapshot.canvas.delegate)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-foreground hover:text-primary"
                  >
                    {shortenAddress(snapshot.canvas.delegate)}
                  </a>
                </div>
              )}

            {/* Personal delegation highlight — the core request: Ledger cold, hot ENS delegate, agent acts, all verifiable */}
            {isMyAgent && delegateAddress && !isZeroAddrLocal(delegateAddress) && (
              <div className="px-3 py-2 text-xs border-t border-primary/20 mt-1 space-y-1">
                <SectionLabel className="text-primary">Delegation Chain — Cold Ledger → Hot ENS (Verifiable On-Chain)</SectionLabel>
                <div>
                  Primary owner (cold storage / e.g. Ledger):{" "}
                  <a
                    href={etherscanAddress(snapshot.owner.owner)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono hover:text-primary"
                  >
                    {shortenAddress(snapshot.owner.owner, 6)}
                  </a>
                </div>
                <div className="text-muted-foreground">↓ delegated for this specific NFT</div>
                <div>
                  Hot wallet:{" "}
                  <a
                    href={etherscanAddress(delegateAddress)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono hover:text-primary"
                  >
                    {shortenAddress(delegateAddress)}
                  </a>
                  {delegateEnsName && (
                    <>
                      {" "}
                      →{" "}
                      <a
                        href={ensAppUrl(delegateEnsName)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {delegateEnsName}
                      </a>
                    </>
                  )}
                </div>
                <div className="text-foreground/90 pt-0.5">
                  Your Normie NFT is chillin' in cold storage. You've delegated a hot wallet with ENS so the awakened agent can now act on-chain. All verifiable.
                </div>
                {isDelegateController && (
                  <div className="text-[10px] text-muted-foreground">(connected as the delegated hot signer)</div>
                )}
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 pt-1 text-[10px] text-primary">
                  <a href={etherscanAddress(snapshot.owner.owner)} target="_blank" rel="noopener noreferrer" className="hover:underline">owner on etherscan</a>
                  <a href={etherscanAddress(delegateAddress)} target="_blank" rel="noopener noreferrer" className="hover:underline">delegate on etherscan</a>
                  {delegateEnsName && (
                    <a href={ensAppUrl(delegateEnsName)} target="_blank" rel="noopener noreferrer" className="hover:underline">ens.app</a>
                  )}
                </div>
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
      <span className="text-[10px] tracking-[1.5px] text-muted-foreground">{label}</span>
    </div>
  )
}
