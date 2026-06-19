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
import { fetchEthosByUsername } from "@/lib/api/ethos"
import { AlertTriangle, Search, Sparkles } from "lucide-react"
import { useState, useEffect } from "react"
import { useAccount, useSignMessage } from "wagmi"
import { normieImageUrl } from "@/lib/api/normies"
import { useMyNormies } from "@/hooks/use-my-normies"
import { useEnsName } from "@/hooks/use-ens-name"
import { fetchAgentCheck, isAgentCertified } from "@/lib/api/agentcheck"
import type { AgentCheckResult } from "@/lib/types"
import { useQuery } from "@tanstack/react-query"

export function Dashboard() {
  const { address, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()

  const [tokenId, setTokenId] = useState<number>(ZULO.tokenId)
  const [input, setInput] = useState<string>(String(ZULO.tokenId))
  const [myInput, setMyInput] = useState<string>("")

  // Bridge search state
  const [bridgeAddress, setBridgeAddress] = useState<string>("")
  const [bridgeUsername, setBridgeUsername] = useState<string>("")
  const [bridgeUser, setBridgeUser] = useState<any>(null)

  const [endorseResult, setEndorseResult] = useState<{ message: string; signature?: string } | null>(null)

  const { data: snapshot, isLoading, isError } = useNormie(tokenId)
  const ownerAddress = snapshot?.owner.owner
  const {
    data: ethos,
    isLoading: ethosLoading,
    isError: ethosError,
  } = useEthosScore(ownerAddress)

  // AgentCheck trust signals (API rating + on-chain cert)
  const { data: agentCheck, isLoading: agentCheckLoading } = useQuery({
    queryKey: ["agentcheck", ownerAddress],
    queryFn: () => fetchAgentCheck(ownerAddress || undefined),
    enabled: !!ownerAddress,
    staleTime: 5 * 60 * 1000,
  })

  const { data: isCertified, isLoading: certLoading } = useQuery({
    queryKey: ["agent-certified", ownerAddress],
    queryFn: () => isAgentCertified(ownerAddress || undefined),
    enabled: !!ownerAddress,
    staleTime: 5 * 60 * 1000,
  })

  const ownerUsername = ethos?.user?.username || null

  const agentType = snapshot?.traits?.attributes?.find(
    (t: any) => t.trait_type === "Type"
  )?.value || "Unknown"

  const isAgentType = agentType === "Agent"

  const delegate = snapshot?.canvas?.delegate
  const isZeroAddr = (a?: string | null) =>
    !a || a === "0x0000000000000000000000000000000000000000"

  const isOwnerMatch =
    !!isConnected &&
    !!address &&
    !!ownerAddress &&
    address.toLowerCase() === ownerAddress.toLowerCase()

  const isDelegateMatch =
    !!isConnected &&
    !!address &&
    !!delegate &&
    !isZeroAddr(delegate) &&
    address.toLowerCase() === delegate.toLowerCase()

  // Delegate support (hot wallet / cold storage pattern via Delegate.xyz):
  // - isMyAgent includes delegates so personal features (Horizon auto, titles, storage) work for judges/users using hot wallets.
  // - Snapshot data (traits, owner, delegate, canvas) is always fetched by tokenId, independent of connected wallet.
  // - Linkage proof and UI explicitly handle owner + delegate.
  const isMyAgent = isOwnerMatch || isDelegateMatch

  const { data: delegateEnsName } = useEnsName(
    !isZeroAddr(delegate) ? delegate : undefined
  )

  const { data: myNormies = [] } = useMyNormies(address)
  const { data: ownerAgents = [] } = useMyNormies(ownerAddress)
  const { data: bridgeAgents = [] } = useMyNormies(bridgeAddress || undefined)

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
    const trimmed = input.trim()
    if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
      // Bridge: address -> list agents
      setBridgeAddress(trimmed)
      setBridgeUsername("")
      setBridgeUser(null)
      setTokenId(ZULO.tokenId)
    } else if (!/^\d+$/.test(trimmed)) {
      // username
      setBridgeUsername(trimmed)
      setBridgeAddress("")
      loadBridgeByUsername(trimmed)
      setTokenId(ZULO.tokenId)
    } else {
      const parsed = Number.parseInt(trimmed, 10)
      if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 9999) {
        setTokenId(parsed)
        setBridgeAddress("")
        setBridgeUsername("")
        setBridgeUser(null)
      }
    }
  }

  function loadMyAgent() {
    const parsed = Number.parseInt(myInput, 10)
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 9999) {
      setTokenId(parsed)
      setInput(String(parsed))
      setMyInput("")
      setBridgeAddress("")
      setBridgeUsername("")
      setBridgeUser(null)
    }
  }

  async function handleEndorse(targetId: number) {
    if (!address || myNormies.length === 0) return
    const endorserId = myNormies[0]
    const message = `I (owner of Normie #${endorserId}) endorse Normie #${targetId} as a high quality awakened agent with strong on-chain reputation and clean signal.\nWallet: ${address}\nIssued: ${new Date().toISOString()}\n\nThis signature is a public, verifiable endorsement from one awakened owner to another. Use it to build trust in the network.`
    try {
      const signature = await signMessageAsync({ message })
      setEndorseResult({ message, signature })
    } catch (e) {
      // ignore cancel
    }
  }

  async function loadBridgeByUsername(username: string) {
    if (!username) return
    try {
      const user = await fetchEthosByUsername(username)
      setBridgeUser(user)
      if (user) {
        const addr = user.userkeys?.find((k: string) => k.startsWith('address:'))?.split(':')[1]
        if (addr) {
          setBridgeAddress(addr)
        }
      }
    } catch (e) {
      console.error(e)
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
            placeholder={isMyAgent ? "explore any token or @username or 0x addr" : "search any token or @username or 0x addr"}
            className="w-full bg-transparent py-3 pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
        <Button type="submit" variant="outline" className="uppercase tracking-[1px]">Search</Button>
      </form>

      {/* Profile Bridge UI - sexy linked profiles */}
      {(bridgeUsername || bridgeAddress) && (
        <div className="border border-primary/30 bg-card p-4">
          <div className="uppercase tracking-[2px] text-sm text-primary mb-2">PROFILE BRIDGE</div>
          {bridgeUser && (
            <div className="mb-2">
              <a href={bridgeUser.links?.profile || `https://app.ethos.network/profile/x/${bridgeUser.username}`} target="_blank" className="text-primary">
                @{bridgeUser.username} (score {bridgeUser.score})
              </a>
              {bridgeUser.avatarUrl && <img src={bridgeUser.avatarUrl} className="inline size-6 ml-2" />}
            </div>
          )}
          {bridgeAgents.length > 0 && (
            <div>
              <div className="text-xs mb-1">Agents:</div>
              <div className="flex flex-wrap gap-2">
                {bridgeAgents.map((id: number) => (
                  <button key={id} onClick={() => { setTokenId(id); setInput(String(id)); }} className="border px-2 py-1 text-xs flex items-center gap-1">
                    <img src={normieImageUrl(id)} className="size-5 pixel-frame" />
                    #{id}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {isMyAgent && (
        <div className="text-center text-sm uppercase tracking-[3px] border border-primary py-2 text-primary">
          THIS IS YOUR AWAKENED AGENT — THE DASHBOARD IS YOURS
          {isDelegateMatch && !isOwnerMatch && <span className="block text-[10px] normal-case tracking-normal mt-1 text-primary/70">(accessed via delegated hot wallet)</span>}
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
          <AgentCard
            snapshot={snapshot}
            isLoading={isLoading}
            isMyAgent={isMyAgent}
            ownerEthosUsername={ownerUsername}
            delegateAddress={delegate}
            delegateEnsName={delegateEnsName}
          />

          {/* Action Buttons */}
          {snapshot && (
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <div className={isMyAgent ? "flex-1" : ""}>
                <AgentHorizonModal tokenId={tokenId} isMyAgent={isMyAgent} />
              </div>
              <LinkageProofModal tokenId={tokenId} ownerAddress={snapshot.owner.owner} delegateAddress={snapshot.canvas.delegate} />
              {isConnected && myNormies.length > 0 && !isMyAgent && (
                <Button onClick={() => handleEndorse(tokenId)} variant="outline" className="uppercase tracking-[1px]">ENDORSE</Button>
              )}
            </div>
          )}

          {endorseResult && (
            <div className="border border-primary/30 bg-card p-4 text-xs">
              <div className="font-medium mb-1">Endorsement signature (copy & share)</div>
              <div className="font-mono break-all mb-2">{endorseResult.message}</div>
              <div className="font-mono break-all text-primary">{endorseResult.signature}</div>
              <button onClick={() => { navigator.clipboard.writeText(endorseResult.message + '\n\n' + (endorseResult.signature || '')); }} className="mt-2 text-primary underline">Copy to clipboard</button>
              <button onClick={() => setEndorseResult(null)} className="ml-4">Dismiss</button>
            </div>
          )}

          {/* Trust & Gate Signals (AgentCheck + Trait Gating) */}
          {ownerAddress && snapshot && (
            <div className="text-xs border border-primary/20 bg-card p-3">
              <div className="uppercase tracking-widest text-[10px] text-primary mb-1 flex items-center gap-2">
                TRUST &amp; GATE SIGNALS
                {isMyAgent && <span className="text-[9px] bg-primary/10 px-1 py-0.5 rounded">YOUR AGENT</span>}
              </div>

              {/* AgentCheck */}
              <div className="mb-2">
                {agentCheckLoading || certLoading ? (
                  <span className="text-muted-foreground">Loading trust signals...</span>
                ) : agentCheck ? (
                  <div>
                    AgentCheck: <span className="font-medium text-primary">{agentCheck.rating || "N/A"}</span>
                    {(agentCheck.certified || isCertified) && <span className="ml-2 text-emerald-400">✓ Certified</span>}
                    {Array.isArray(agentCheck.forensicFlags) && agentCheck.forensicFlags.length > 0 && (
                      <span className="ml-2 text-amber-400">flags: {agentCheck.forensicFlags.slice(0,2).join(", ")}</span>
                    )}
                    <a href={`https://agentcheck-bice.vercel.app/api/check?wallet=${ownerAddress}`} target="_blank" rel="noopener noreferrer" className="ml-2 underline text-primary">report</a>
                  </div>
                ) : (
                  <span className="text-muted-foreground">AgentCheck: no data (API fails silently)</span>
                )}
                {isCertified === false && <span className="ml-2 text-amber-400">(not on-chain certified)</span>}
              </div>

              {/* Trait Gate (preview for TraitGatedPredicate + AgentCheck composition) */}
              {snapshot.traits?.attributes && (
                <div className="pt-2 border-t border-primary/10">
                  {snapshot.traits.attributes
                    .filter((t: any) => t.trait_type === "Type")
                    .map((t: any, i: number) => {
                      const isAgentType = t.value === "Agent"
                      return (
                        <div key={i}>
                          Type: <span className="font-medium">{t.value}</span>
                          {isAgentType && (
                            <span className="ml-1 text-emerald-400">
                              → qualifies for Agent trait gates
                              {isCertified && " + AgentCheck cert"}
                            </span>
                          )}
                          {!isAgentType && <span className="ml-1 text-muted-foreground">(may not pass Agent-only gates)</span>}
                        </div>
                      )
                    })}
                  <div className="text-[9px] text-muted-foreground mt-1">
                    On-chain via TraitGatedPredicate (ERC-8257) + AgentCheck cert registry.
                  </div>
                </div>
              )}
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
            <OwnershipCard
              snapshot={snapshot}
              isLoading={isLoading}
              isMyAgent={isMyAgent}
              ownerEthosUsername={ownerUsername}
              delegateAddress={delegate}
              delegateEnsName={delegateEnsName}
              isDelegateController={isDelegateMatch}
            />
          </div>

          {/* Linked agents via owner (after Ethos box / grid for visibility) */}
          {snapshot && ownerAgents.length > 1 && (() => {
            const siblings = ownerAgents.filter((id: number) => id !== tokenId).slice(0, 10);
            if (siblings.length === 0) return null;
            return (
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Linked via owner (same human rep)</div>
                <div className="flex flex-wrap gap-2">
                  {siblings.map((id) => (
                    <button
                      key={id}
                      onClick={() => {
                        setTokenId(id);
                        setInput(String(id));
                      }}
                      className={`flex items-center gap-1.5 px-2 py-1 text-xs border transition-colors ${tokenId === id ? 'border-primary bg-primary text-background' : 'border-border hover:bg-card-hover'}`}
                    >
                      <img src={normieImageUrl(id)} alt={`#${id}`} className="size-5 pixel-frame" width={20} height={20} />
                      <span>#{id}</span>
                    </button>
                  ))}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">Click to slide through linked profiles backed by the owner's Ethos score.</div>
              </div>
            );
          })()}
        </>
      )}
    </div>
  )
}
