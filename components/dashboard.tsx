"use client"

import { AgentCard } from "@/components/agent-card"
import { Erc8004Card } from "@/components/erc8004-card"
import { EthosReputation } from "@/components/ethos-reputation"
import { LinkageProofModal } from "@/components/linkage-proof-modal"
import { OwnershipCard } from "@/components/ownership-card"
import { AgentHorizonModal } from "@/components/zulo-suggests-modal"
import { ToolsModal } from "@/components/tools-modal"
import { ZuloRecommendsModal, type Recommendation } from "@/components/zulo-recommends-modal"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { SectionLabel } from "@/components/ui/section-label"
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
import { isAgentAwakened, normiesApi } from "@/lib/api/normies"
import { tools } from "@/lib/tools"
import type { AgentCheckResult } from "@/lib/types"
import { useQuery } from "@tanstack/react-query"
import { useConnectModal } from "@rainbow-me/rainbowkit"

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
  const [showToolsModal, setShowToolsModal] = useState(false)
  const [showZuloRecommendsModal, setShowZuloRecommendsModal] = useState(false)

  const { openConnectModal } = useConnectModal()

  // Zulo Recommends state (lifted for the polished presentational modal)
  const [zuloRecommendations, setZuloRecommendations] = useState<Recommendation[]>([])
  const [zuloLoading, setZuloLoading] = useState(false)
  const [zuloError, setZuloError] = useState<string | null>(null)

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

  const handleZuloRecommendsClick = () => {
    if (!isConnected) {
      openConnectModal?.()
      return
    }

    // Open modal immediately in loading state, then fetch
    setZuloRecommendations([])
    setZuloError(null)
    setZuloLoading(true)
    setShowZuloRecommendsModal(true)

    performZuloFetch()
  }

  async function performZuloFetch() {
    try {
      const awakened = await isAgentAwakened(tokenId)
      if (!awakened) {
        setZuloError('Zulo Recommends is only available to awakened agents. Awaken your Normie first to unlock personalized tool suggestions from Zulo.')
        setZuloLoading(false)
        return
      }

      const agentData = await normiesApi.agentInfo(tokenId)

      const res = await fetch('/api/zulo-recommends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenId,
          agentName: agentData.name,
          traits: agentData.traits?.attributes || [],
          agentType: agentData.type,
        }),
      })

      const data = await res.json()
      if (data.error) {
        setZuloError(data.error)
        setZuloLoading(false)
        return
      }

      if (data.recommendations) {
        const parsed = parseRecommendations(data.recommendations)
        setZuloRecommendations(parsed)
      }
    } catch (e) {
      setZuloError('Could not fetch recommendations.')
    } finally {
      setZuloLoading(false)
    }
  }

  // Parser: converts the AI text response into structured cards (matches tool urls/categories)
  function parseRecommendations(text: string): Recommendation[] {
    const recs: Recommendation[] = []
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    let current: Partial<Recommendation> | null = null

    for (const line of lines) {
      if (line.startsWith('**') && line.endsWith('**')) {
        if (current?.name) {
          const match = tools.find(t => t.name.toLowerCase().includes(current!.name!.toLowerCase().split(' ')[0]))
          recs.push({
            name: current.name,
            reason: current.reason || '',
            category: match?.category || 'Tool',
            url: match?.url || '#',
          })
        }
        current = { name: line.replace(/\*\*/g, '').trim(), reason: '' }
      } else if (current) {
        current.reason = (current.reason || '') + ' ' + line
      }
    }

    if (current?.name) {
      const match = tools.find(t => t.name.toLowerCase().includes(current!.name!.toLowerCase().split(' ')[0]))
      recs.push({
        name: current.name,
        reason: current.reason || '',
        category: match?.category || 'Tool',
        url: match?.url || '#',
      })
    }

    return recs.length > 0 ? recs : []
  }

  return (
    <div className="flex flex-col gap-8 max-w-4xl mx-auto divide-y divide-border/60 pixel-texture">
      {/* Personal / Awakened View — focused and premium */}
      {isConnected && (
        <div className="rounded-2xl border border-border bg-card/70 p-5">
          <SectionLabel className="text-primary mb-3 text-center">Your Awakened View</SectionLabel>

          {/* My Agents selector — centered pills */}
          {myNormies.length > 0 && (
            <div className="flex justify-center mb-4">
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
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all border ${isActive ? "bg-primary text-primary-foreground border-primary" : "bg-secondary/50 hover:bg-secondary border-border"}`}
                    >
                      <img
                        src={normieImageUrl(id)}
                        alt={`Normie #${id}`}
                        className="size-5 pixel-frame"
                        width={20}
                        height={20}
                      />
                      <span className="font-mono">#{id}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Manual entry — clean inline */}
          <div className="flex items-center gap-2 max-w-sm mx-auto">
            <input
              value={myInput}
              onChange={(e) => setMyInput(e.target.value)}
              inputMode="numeric"
              placeholder="Enter token id to explore"
              className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none border-b border-border py-2"
            />
            <Button onClick={loadMyAgent} variant="ghost" size="sm" className="text-xs">LOAD</Button>
          </div>
        </div>
      )}

      {/* Search — centered, focused */}
      <form onSubmit={handleSearch} className="mx-auto max-w-xl">
        <div className="flex items-center rounded-2xl border border-border bg-card px-4 py-1.5 shadow-sm">
          <Search className="pointer-events-none size-4 text-muted-foreground mr-3" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            inputMode="numeric"
            placeholder="Search token, @username, or 0x address"
            className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none py-2"
          />
          <Button type="submit" variant="outline" size="sm" className="ml-2">Search</Button>
        </div>
        <p className="text-center text-[10px] text-muted-foreground mt-2 tracking-widest">EXPLORE ANY NORMIE — PUBLIC OR PERSONAL</p>
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
        <div className="mx-auto text-center">
          <div className="inline-block text-xs uppercase tracking-[3.5px] border border-primary/60 px-4 py-1 rounded-full text-primary">
            YOUR AWAKENED AGENT
            {isDelegateMatch && !isOwnerMatch && <span className="ml-1.5 text-[9px] normal-case tracking-normal text-primary/60">• via delegate</span>}
          </div>
        </div>
      )}

      {!isConnected && (
        <div className="text-center text-sm text-muted-foreground max-w-xs mx-auto">
          Connect your wallet to unlock personal views, Zulo Recommends, and your agent’s full dashboard.
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

          {/* Action Buttons — focused, premium, on-center */}
          {snapshot && (
            <div className="pt-4">
              <SectionLabel className="text-center mb-4">Tools &amp; Actions</SectionLabel>

              <div className="flex flex-wrap justify-center gap-3">
                <div className="text-center">
                  <AgentHorizonModal tokenId={tokenId} isMyAgent={isMyAgent} />
                  <p className="text-[10px] text-muted-foreground mt-1.5">Zulo Horizon</p>
                </div>

                <LinkageProofModal tokenId={tokenId} ownerAddress={snapshot.owner.owner} delegateAddress={snapshot.canvas.delegate} />

                {isConnected && myNormies.length > 0 && !isMyAgent && (
                  <Button onClick={() => handleEndorse(tokenId)} variant="outline" size="sm">
                    Endorse
                  </Button>
                )}

                <div className="text-center">
                  <Button 
                    onClick={() => setShowToolsModal(true)} 
                    variant="outline"
                  >
                    Browse Tools
                  </Button>
                  <p className="text-[10px] text-muted-foreground mt-1.5">Community tools</p>
                </div>

                <div className="text-center">
                  <Button 
                    onClick={handleZuloRecommendsClick}
                    variant="outline"
                    className="glow-primary"
                  >
                    Zulo Recommends
                  </Button>
                  <p className="text-[10px] text-muted-foreground mt-1.5 max-w-[200px] mx-auto">
                    {isConnected ? "Personalized tool suggestions" : "Connect to unlock"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {endorseResult && (
            <div className="mx-auto max-w-lg border border-primary/30 bg-card rounded-xl p-5 text-xs">
              <div className="font-medium mb-3 tracking-widest text-primary">ENDORSEMENT SIGNATURE</div>
              <div className="font-mono text-[10px] break-all bg-background/60 p-3 rounded mb-3">{endorseResult.message}</div>
              <div className="font-mono text-[10px] break-all text-primary mb-4">{endorseResult.signature}</div>
              <div className="flex gap-4 text-xs">
                <button onClick={() => { navigator.clipboard.writeText(endorseResult.message + '\n\n' + (endorseResult.signature || '')); }} className="text-primary hover:underline">Copy signature</button>
                <button onClick={() => setEndorseResult(null)} className="text-muted-foreground hover:text-foreground">Dismiss</button>
              </div>
            </div>
          )}

          <ToolsModal isOpen={showToolsModal} onClose={() => setShowToolsModal(false)} />
          <ZuloRecommendsModal 
            isOpen={showZuloRecommendsModal} 
            onClose={() => {
              setShowZuloRecommendsModal(false)
              // reset for next open with potentially different token
              setZuloRecommendations([])
              setZuloError(null)
            }} 
            recommendations={zuloRecommendations}
            isLoading={zuloLoading}
            error={zuloError || undefined}
          />

          {/* Trust & Gate Signals — refined & focused */}
          {ownerAddress && snapshot && (
            <div className="mx-auto max-w-xl text-xs border border-border bg-card/60 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <SectionLabel className="text-primary">Trust &amp; Gate Signals</SectionLabel>
                {isMyAgent && <span className="text-[9px] bg-primary/10 px-2 py-0.5 rounded-full text-primary">YOUR AGENT</span>}
              </div>

              {/* AgentCheck */}
              <div className="mb-4">
                {agentCheckLoading || certLoading ? (
                  <span className="text-muted-foreground">Loading trust signals...</span>
                ) : agentCheck ? (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>AgentCheck <span className="font-medium text-primary">{agentCheck.rating || "N/A"}</span></span>
                    {(agentCheck.certified || isCertified) && <span className="text-emerald-500">✓ Certified</span>}
                    {Array.isArray(agentCheck.forensicFlags) && agentCheck.forensicFlags.length > 0 && (
                      <span className="text-amber-500">flags: {agentCheck.forensicFlags.slice(0,2).join(", ")}</span>
                    )}
                    <a href={`https://agentcheck-bice.vercel.app/api/check?wallet=${ownerAddress}`} target="_blank" rel="noopener noreferrer" className="underline text-primary">view report</a>
                  </div>
                ) : (
                  <span className="text-muted-foreground">AgentCheck: no data</span>
                )}
              </div>

              {/* Trait Gate */}
              {snapshot.traits?.attributes && (
                <div className="pt-3 border-t border-border/60 text-[10px] text-muted-foreground">
                  {snapshot.traits.attributes
                    .filter((t: any) => t.trait_type === "Type")
                    .map((t: any, i: number) => {
                      const isAgentType = t.value === "Agent"
                      return (
                        <span key={i}>
                          Type: <span className="text-foreground font-medium">{t.value}</span>
                          {isAgentType && " — qualifies for advanced agent features"}
                          {!isAgentType && " (limited gate access)"}
                        </span>
                      )
                    })}
                </div>
              )}
            </div>
          )}

          {/* Cards Grid — focused and balanced */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-fade-in">
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

          {/* Linked agents via owner — subtle & centered */}
          {snapshot && ownerAgents.length > 1 && (() => {
            const siblings = ownerAgents.filter((id: number) => id !== tokenId).slice(0, 8);
            if (siblings.length === 0) return null;
            return (
              <div className="text-center">
                <SectionLabel className="mb-2">Also Linked Via Owner</SectionLabel>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {siblings.map((id: number) => (
                    <button
                      key={id}
                      onClick={() => {
                        setTokenId(id);
                        setInput(String(id));
                      }}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] border transition-all ${tokenId === id ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-card'}`}
                    >
                      <img src={normieImageUrl(id)} alt={`#${id}`} className="size-4 pixel-frame" width={16} height={16} />
                      <span>#{id}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}
        </>
      )}
    </div>
  )
}
