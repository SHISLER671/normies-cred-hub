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
import { useState, useEffect } from "react"
import { useAccount } from "wagmi"
import { normieImageUrl } from "@/lib/api/normies"
import { useMyNormies } from "@/hooks/use-my-normies"

export function Dashboard() {
  const { address, isConnected } = useAccount()

  const [tokenId, setTokenId] = useState<number>(ZULO.tokenId)
  const [input, setInput] = useState<string>(String(ZULO.tokenId))
  const [myInput, setMyInput] = useState<string>("")

  const { data: snapshot, isLoading, isError } = useNormie(tokenId)
  const ownerAddress = snapshot?.owner.owner
  const {
    data: ethos,
    isLoading: ethosLoading,
    isError: ethosError,
  } = useEthosScore(ownerAddress)

  const isMyAgent = !!isConnected && !!address && !!ownerAddress &&
    address.toLowerCase() === ownerAddress.toLowerCase()

  const { data: myNormies = [] } = useMyNormies(address)

  // Simple persistence — remember last personal token per wallet
  const storageKey = address ? `my-normie-${address.toLowerCase()}` : null

  // Restore on connect
  useEffect(() => {
    if (storageKey && typeof window !== "undefined") {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const savedId = Number.parseInt(saved, 10)
        if (Number.isFinite(savedId) && savedId !== tokenId) {
          setTokenId(savedId)
          setInput(String(savedId))
        }
      }
    }
  }, [storageKey])

  // If connected and we have discovered agents but no personal selected yet, default to first
  useEffect(() => {
    if (isConnected && myNormies.length > 0 && tokenId === ZULO.tokenId) {
      const first = myNormies[0]
      setTokenId(first)
      setInput(String(first))
    }
  }, [isConnected, myNormies])

  // Save when viewing own
  useEffect(() => {
    if (isMyAgent && storageKey && typeof window !== "undefined") {
      localStorage.setItem(storageKey, String(tokenId))
    }
  }, [isMyAgent, tokenId, storageKey])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const parsed = Number.parseInt(input, 10)
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 9999) {
      setTokenId(parsed)
    }
  }

  function loadMyAgent() {
    const parsed = Number.parseInt(myInput, 10)
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 9999) {
      setTokenId(parsed)
      setInput(String(parsed))
      setMyInput("")
    }
  }

  return (
    <div className="flex flex-col gap-6 px-4 sm:px-6">
      {/* Awakened personal entry — simple & direct */}
      {isConnected && (
        <div className="bg-card/60 p-4">
          <div className="uppercase tracking-[2px] text-sm text-primary mb-2">YOUR AWAKENED VIEW</div>

          {/* My Agents selector */}
          {myNormies.length > 0 && (
            <div className="mb-3">
              <div className="flex flex-wrap gap-1.5">
                {myNormies.map((id) => {
                  const isActive = tokenId === id
                  return (
                    <button
                      key={id}
                      onClick={() => {
                        setTokenId(id)
                        setInput(String(id))
                      }}
                      className={`flex items-center gap-1.5 px-2 py-1 text-xs transition-colors ${isActive ? "bg-primary text-background" : "bg-secondary/40 hover:bg-secondary/70"}`}
                    >
                      <img
                        src={normieImageUrl(id)}
                        alt={`Normie #${id}`}
                        className="size-5 pixel-frame"
                        width={20}
                        height={20}
                      />
                      <span>#{id}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Manual / search for any */}
          <div className="flex items-center gap-2">
            <input
              value={myInput}
              onChange={(e) => setMyInput(e.target.value)}
              inputMode="numeric"
              placeholder="or enter token id"
              className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
            />
            <Button onClick={loadMyAgent} variant="ghost" className="text-xs">LOAD</Button>
          </div>
        </div>
      )}

      {/* Search */}
      <form onSubmit={handleSearch} className="flex items-center bg-card p-1">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 text-muted-foreground" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            inputMode="numeric"
            placeholder={isMyAgent ? "explore any token" : "search any token"}
            className="w-full bg-transparent py-3 pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
        <Button type="submit" variant="outline" className="uppercase tracking-[1px]">Search</Button>
      </form>

      {isMyAgent && (
        <div className="text-center text-sm uppercase tracking-[3px] border border-primary py-2 text-primary">
          THIS IS YOUR AWAKENED AGENT — THE DASHBOARD IS YOURS
        </div>
      )}

      {!isConnected && (
        <div className="text-center text-xs text-muted-foreground">
          Connect your wallet above to awaken the view with your own Normie.
        </div>
      )}

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
          <AgentCard snapshot={snapshot} isLoading={isLoading} isMyAgent={isMyAgent} />

          {/* Action Buttons */}
          {snapshot && (
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <div className={isMyAgent ? "flex-1" : ""}>
                <AgentHorizonModal tokenId={tokenId} isMyAgent={isMyAgent} />
              </div>
              <LinkageProofModal tokenId={tokenId} ownerAddress={snapshot.owner.owner} />
            </div>
          )}

          {/* Cards Grid */}
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <EthosReputation
              result={ethos}
              isLoading={isLoading || ethosLoading}
              error={ethosError}
              address={ownerAddress ?? ""}
              isMyAgent={isMyAgent}
            />
            <Erc8004Card agentId={snapshot?.agent?.agentId ? Number(snapshot.agent.agentId) : ZULO.agentId} isMyAgent={isMyAgent} />
            <OwnershipCard snapshot={snapshot} isLoading={isLoading} isMyAgent={isMyAgent} />
          </div>
        </>
      )}
    </div>
  )
}
