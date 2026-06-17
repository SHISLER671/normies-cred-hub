"use client"

import { AgentCard } from "@/components/agent-card"
import { Erc8004Card } from "@/components/erc8004-card"
import { EthosReputation } from "@/components/ethos-reputation"
import { LinkageProofModal } from "@/components/linkage-proof-modal"
import { OwnershipCard } from "@/components/ownership-card"
import { AgentHorizonModal } from "@/components/zulo-suggests-modal"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ZULO } from "@/constants/contracts"
import { useEthosScore, useNormie } from "@/hooks/use-normie"
import { AlertTriangle, Search, Sparkles } from "lucide-react"
import { useState } from "react"

export function Dashboard() {
  const [tokenId, setTokenId] = useState<number>(ZULO.tokenId)
  const [input, setInput] = useState<string>(String(ZULO.tokenId))

  const { data: snapshot, isLoading, isError } = useNormie(tokenId)
  const ownerAddress = snapshot?.owner.owner
  const {
    data: ethos,
    isLoading: ethosLoading,
    isError: ethosError,
  } = useEthosScore(ownerAddress)

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const parsed = Number.parseInt(input, 10)
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 9999) {
      setTokenId(parsed)
    }
  }

  return (
    <div className="flex flex-col gap-8 px-4 sm:px-6">
      {/* Search */}
      <form onSubmit={handleSearch} className="flex items-center gap-2 rounded-2xl border border-border bg-card p-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            inputMode="numeric"
            placeholder="Look up a Normie by token ID (0–9999)"
            className="w-full rounded-xl bg-secondary/50 py-3.5 pl-11 pr-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>
        <Button type="submit" className="gap-2 px-6">Search</Button>
      </form>

      {isError ? (
        <Card className="border-destructive/40">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertTriangle className="size-8 text-destructive" />
            <p className="font-medium">Could not load Normie #{tokenId}</p>
            <p className="max-w-sm text-sm text-muted-foreground">Try another token ID.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <AgentCard snapshot={snapshot} isLoading={isLoading} />

          {/* Prominent Action Buttons */}
          {snapshot && (
            <div className="flex flex-col sm:flex-row gap-3">
              <AgentHorizonModal tokenId={tokenId} />
              <LinkageProofModal tokenId={tokenId} ownerAddress={snapshot.owner.owner} />
            </div>
          )}

          {/* Cards Grid */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <EthosReputation
              result={ethos}
              isLoading={isLoading || ethosLoading}
              error={ethosError}
              address={ownerAddress ?? ""}
            />
            <Erc8004Card agentId={snapshot?.agent?.agentId ? Number(snapshot.agent.agentId) : ZULO.agentId} />
            <OwnershipCard snapshot={snapshot} isLoading={isLoading} />
          </div>
        </>
      )}
    </div>
  )
}
