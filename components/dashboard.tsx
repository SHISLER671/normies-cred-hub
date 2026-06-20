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
import { AlertTriangle, Boxes, Layers, Palette, Search, ShieldCheck, Sparkles } from "lucide-react"
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

  function Metric({ label, value }: { label: string; value: string }) {
    return (
      <div className="flex flex-col items-center py-2.5">
        <span className="font-heading text-lg font-bold tabular-nums tracking-[-1px]">{value}</span>
        <span className="text-[10px] tracking-[1.5px] text-muted-foreground">{label}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-10 max-w-4xl mx-auto pixel-texture">
      {/* Personal / Awakened View — focused and premium */}
      {isConnected && (
        <div className="rounded-2xl border border-border bg-card/70 p-5">
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
              placeholder="Enter token id"
              className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none border-b border-border py-2"
            />
            <Button onClick={loadMyAgent} variant="ghost" size="sm" className="text-xs">LOAD</Button>
          </div>
        </div>
      )}

      {/* Profile Bridge UI - sexy linked profiles */}
      {(bridgeUsername || bridgeAddress) && (
        <div className="border border-primary/30 bg-card p-4">
          <SectionLabel className="text-primary mb-2">Profile Bridge</SectionLabel>
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
              <SectionLabel className="mb-1">Agents</SectionLabel>
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
          <div className="inline-block text-xs tracking-[1.5px] border border-primary/60 px-4 py-1 rounded-full text-primary">
            Your Awakened Agent
            {isDelegateMatch && !isOwnerMatch && <span className="ml-1.5 text-[9px] normal-case tracking-normal text-primary/60">• via delegate</span>}
          </div>
        </div>
      )}

      {!isConnected && (
        <div className="text-center text-sm text-muted-foreground max-w-xs mx-auto">
          Connect your wallet to unlock your agent's full view and Zulo's personalized recommendations.
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
          {/* Your Agent + Zulo — core focused block */}
          <div className="space-y-6">
            <AgentCard
              snapshot={snapshot}
              isLoading={isLoading}
              isMyAgent={isMyAgent}
              ownerEthosUsername={ownerUsername}
              delegateAddress={delegate}
              delegateEnsName={delegateEnsName}
            />

            {/* Zulo Recommends — elevated as a core agent skill */}
            {snapshot && (
              <div className="bg-card border border-primary/40 rounded-2xl p-6 text-center shadow-sm">
                <SectionLabel className="text-primary mb-1.5">ZULO'S AGENT SKILL</SectionLabel>
                <h3 className="font-heading text-2xl tracking-tight mb-1.5">Zulo Recommends</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mb-2">
                  Tailored to <span className="text-foreground">this specific agent's</span> on-chain signals.
                </p>
                <p className="text-xs text-muted-foreground mb-4">
                  {isConnected 
                    ? "Zulo has analyzed the data and is ready with personalized suggestions." 
                    : "Connect your wallet to unlock Zulo's recommendations for this agent."}
                </p>
                <Button 
                  onClick={handleZuloRecommendsClick}
                  variant="default"
                  className="glow-primary px-8 py-3 text-base"
                >
                  <Sparkles className="size-4 mr-2" />
                  Get Zulo's Recommendations
                </Button>
              </div>
            )}
          </div>

          {/* Prove Linkage — centered */}
          {snapshot && (
            <div className="text-center">
              <LinkageProofModal tokenId={tokenId} ownerAddress={snapshot.owner.owner} delegateAddress={snapshot.canvas.delegate} />
            </div>
          )}

          {/* Explore & Verify */}
          {snapshot && (
            <div className="pt-2">
              <SectionLabel className="text-center mb-3">Explore &amp; Verify</SectionLabel>
              <p className="text-center text-[10px] text-muted-foreground mb-2">Including more from Zulo</p>

              <div className="flex flex-wrap justify-center gap-3">
                <div className="text-center">
                  <AgentHorizonModal tokenId={tokenId} isMyAgent={isMyAgent} />
                  <p className="text-[10px] text-muted-foreground mt-1.5">Zulo Horizon Insights</p>
                </div>

                {isConnected && myNormies.length > 0 && !isMyAgent && (
                  <Button onClick={() => handleEndorse(tokenId)} variant="outline" size="sm">
                    Endorse
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Browse Tools */}
          {snapshot && (
            <div className="text-center">
              <Button 
                onClick={() => setShowToolsModal(true)} 
                variant="outline"
              >
                Browse Tools
              </Button>
              <p className="text-[10px] text-muted-foreground mt-1.5">Community tools</p>
            </div>
          )}

          {/* Discover */}
          <div className="space-y-4">
            <SectionLabel className="text-center">Discover</SectionLabel>
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
              <p className="text-center text-[10px] text-muted-foreground mt-2 tracking-widest">Explore any Normie — public or personal</p>
            </form>
          </div>

          {endorseResult && (
            <div className="mx-auto max-w-lg border border-primary/30 bg-card rounded-xl p-5 text-xs">
              <SectionLabel className="text-primary mb-2">Endorsement Signature</SectionLabel>
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

          {/* On-Chain Insights */}
          <div>
            <SectionLabel className="text-center mb-4">On-Chain Insights</SectionLabel>

            {/* On-Chain Identity, Ownership & Delegate */}
            <div className="mb-6">
              <div className="mb-3">
                <h3 className="font-semibold text-base flex items-center gap-2 text-primary">
                  <Boxes className="size-4" /> On-Chain Identity, Ownership &amp; Delegate
                </h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  This confirms your Normie has been awakened and registered as an ERC-8004 agent. Your ownership shows who controls the NFT. Delegation allows your agent to act on-chain while your NFT stays secure in cold storage.
                </p>
              </div>
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

            {/* Canvas */}
            {snapshot && (
              <div className="mb-6">
                <div className="mb-3">
                  <h3 className="font-semibold text-base flex items-center gap-2 text-primary">
                    <Palette className="size-4" /> Canvas
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Your canvas shows your Normie's current on-chain pixel state, level, and recent activity.
                  </p>
                </div>
                <Card className="flex h-full flex-col">
                  <CardContent className="flex flex-1 flex-col gap-3 text-sm">
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

                    <p className="mt-auto pt-2 text-[10px] text-muted-foreground">
                      {isMyAgent ? "YOUR PIXELS. YOUR PROOF. YOUR AGENT." : "LIVE NORMIES REGISTRY. PIXEL CANVAS BY THE PEOPLE."}
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Ethos Reputation */}
            <div>
              <div className="mb-3">
                <h3 className="font-semibold text-base flex items-center gap-2 text-primary">
                  <ShieldCheck className="size-4" /> Ethos Reputation
                </h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Your Ethos score reflects how the community perceives your on-chain behavior. Higher scores can unlock better opportunities and trust within the ecosystem.
                </p>
              </div>
              <EthosReputation
                result={ethos}
                isLoading={isLoading || ethosLoading}
                error={ethosError}
                address={ownerAddress ?? ""}
                isMyAgent={isMyAgent}
              />
            </div>
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
