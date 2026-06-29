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
import { useAgentCheck, useEthosScore, useNormie } from "@/hooks/use-normie"
import { AgentCheckCard } from "@/components/agentcheck-card"
import { fetchEthosByUsername } from "@/lib/api/ethos"
import { AlertTriangle, Award, Boxes, CircleCheck, Clock, Fingerprint, Layers, Palette, Search, ShieldCheck, Sparkles, Wallet, Wrench } from "lucide-react"
import { Fragment, useState, useEffect } from "react"
import { useAccount, useSignMessage } from "wagmi"
import { normieImageUrl } from "@/lib/api/normies"
import { useMyNormies } from "@/hooks/use-my-normies"
import { useEnsName } from "@/hooks/use-ens-name"
import { isAgentAwakened, normiesApi } from "@/lib/api/normies"
import { tools } from "@/lib/tools"
import { useConnectModal } from "@rainbow-me/rainbowkit"
import { Skeleton } from "@/components/ui/skeleton"
import { CredibilityConnector, CredibilitySignal } from "@/components/credibility-signal"
import { ERC8004 } from "@/constants/contracts"
import { etherscanAddress, shortenAddress } from "@/lib/format"
import { getCurrentSignals, validateSignals } from "@/lib/signals"

export function Dashboard() {
  const { address, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()

  const [tokenId, setTokenId] = useState<number>(ZULO.tokenId)
  const [myInput, setMyInput] = useState<string>("")

  // Bridge search state
  const [bridgeAddress, setBridgeAddress] = useState<string>("")
  const [bridgeUsername, setBridgeUsername] = useState<string>("")
  const [bridgeUser, setBridgeUser] = useState<any>(null)

  const [endorseResult, setEndorseResult] = useState<{ message: string; signature?: string } | null>(null)
  const [showToolsModal, setShowToolsModal] = useState(false)
  const [showZuloRecommendsModal, setShowZuloRecommendsModal] = useState(false)
  const [showHorizonModal, setShowHorizonModal] = useState(false)
  const [showLinkageModal, setShowLinkageModal] = useState(false)

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

  const ownerUsername = ethos?.user?.username || null

  const {
    data: agentCheck,
    isLoading: agentCheckLoading,
  } = useAgentCheck(ownerAddress)

  const agentType = snapshot?.traits?.attributes?.find(
    (t: any) => t.trait_type === "Type"
  )?.value || "Unknown"

  const isAgentType = agentType === "Agent"

  const rawFrameworkSignals = getCurrentSignals({ snapshot, ethos, ownerAddress })
  const { validSignals, invalidSignals } = validateSignals(rawFrameworkSignals)
  // Use validated signals when all pass; otherwise keep trusted builders to avoid UI regressions
  const frameworkSignals =
    validSignals.length === rawFrameworkSignals.length
      ? validSignals
      : rawFrameworkSignals

  useEffect(() => {
    if (invalidSignals.length > 0 && process.env.NODE_ENV === "development") {
      console.warn("[Credibility] Invalid signals detected:", invalidSignals)
    }
  }, [invalidSignals])

  const [
    identitySignal,
    ownershipSignal,
    canvasSignal,
    ethosSignal,
    externalSignal,
    wireSignal,
    toolRegistrySignal,
  ] = frameworkSignals

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
        }
      }
    }
  }, [storageKey])

  // If connected and we have discovered agents but no personal selected yet, default to first
  useEffect(() => {
    if (isConnected && myNormies.length > 0 && tokenId === ZULO.tokenId) {
      const first = myNormies[0]
      setTokenId(first)
    }
  }, [isConnected, myNormies])

  // Save when viewing own
  useEffect(() => {
    if (isMyAgent && storageKey && typeof window !== "undefined") {
      localStorage.setItem(storageKey, String(tokenId))
    }
  }, [isMyAgent, tokenId, storageKey])



  function loadMyAgent() {
    const parsed = Number.parseInt(myInput, 10)
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 9999) {
      setTokenId(parsed)
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
          const nameLower = current.name.toLowerCase().trim()
          let match = tools.find(t => t.name.toLowerCase() === nameLower)
          if (!match) {
            // Stricter fuzzy: require tool name or recommended name to contain the other, or high word overlap (at least 2)
            const recWords = nameLower.split(/\s+/).filter(w => w.length > 2)
            const candidates = tools
              .map(t => {
                const tLower = t.name.toLowerCase()
                const overlap = recWords.filter(w => tLower.includes(w)).length
                const mutualIncludes = tLower.includes(nameLower) || nameLower.includes(tLower) ? 5 : 0
                const score = overlap + mutualIncludes
                return { t, score }
              })
              .filter(s => s.score >= 2)
              .sort((a, b) => b.score - a.score)
            match = candidates[0]?.t
          }
          if (match) {
            recs.push({
              name: match.name,  // Use the canonical name from the list
              reason: current.reason || '',
              category: match.category || 'Tool',
              url: match.url || '#',
            })
          }
        }
        current = { name: line.replace(/\*\*/g, '').trim(), reason: '' }
      } else if (current) {
        current.reason = (current.reason || '') + ' ' + line
      }
    }

    if (current?.name) {
      const nameLower = current.name.toLowerCase().trim()
      let match = tools.find(t => t.name.toLowerCase() === nameLower)
      if (!match) {
        const recWords = nameLower.split(/\s+/).filter(w => w.length > 2)
        const candidates = tools
          .map(t => {
            const tLower = t.name.toLowerCase()
            const overlap = recWords.filter(w => tLower.includes(w)).length
            const mutualIncludes = tLower.includes(nameLower) || nameLower.includes(tLower) ? 5 : 0
            const score = overlap + mutualIncludes
            return { t, score }
          })
          .filter(s => s.score >= 2)
          .sort((a, b) => b.score - a.score)
        match = candidates[0]?.t
      }
      if (match) {
        recs.push({
          name: match.name,  // Use the canonical name from the list
          reason: current.reason || '',
          category: match.category || 'Tool',
          url: match.url || '#',
        })
      }
    }

    // Deduplicate by name, keep first occurrence
    const uniqueRecs: Recommendation[] = []
    const seen = new Set<string>()
    for (const rec of recs) {
      const key = rec.name.toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        uniqueRecs.push(rec)
      }
    }

    if (uniqueRecs.length === 0 && text.length > 10) {
      // Fallback: recommend a default tool with the raw text as reason
      const fallback = tools[0]
      uniqueRecs.push({
        name: fallback.name,
        reason: text.substring(0, 300),
        category: fallback.category,
        url: fallback.url,
      })
    }

    return uniqueRecs
  }

  function Metric({ label, value }: { label: string; value: string }) {
    return (
      <div className="flex flex-col items-center py-2.5">
        <span className="font-heading text-lg font-bold tabular-nums tracking-[-1px]">{value}</span>
        <span className="text-xs tracking-[1.5px] text-muted-foreground">{label}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-10 max-w-4xl mx-auto pixel-texture">
      {/* Personal / Awakened View — focused and premium */}
      {isConnected && (
        <div className="rounded-none border border-border bg-card/70 p-5">
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
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-none text-xs transition-all border ${isActive ? "bg-primary text-primary-foreground border-primary" : "bg-secondary/50 hover:bg-secondary border-border"}`}
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
            <label htmlFor="token-id-input" className="sr-only">Normie token ID</label>
            <input
              id="token-id-input"
              value={myInput}
              onChange={(e) => setMyInput(e.target.value)}
              inputMode="numeric"
              placeholder="Enter token id"
              aria-label="Normie token ID"
              className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none border-b border-border py-2 focus:border-primary transition-colors"
            />
            <Button onClick={loadMyAgent} variant="ghost" size="sm" className="text-sm">LOAD</Button>
          </div>
        </div>
      )}

      {/* Profile Bridge UI - sexy linked profiles */}
      {(bridgeUsername || bridgeAddress) && (
        <div className="border border-primary/30 bg-card p-5">
          <SectionLabel className="text-primary mb-2">Profile Bridge</SectionLabel>
          {bridgeUser && (
            <div className="mb-2">
              <a href={bridgeUser.links?.profile || `https://app.ethos.network/profile/x/${bridgeUser.username}`} target="_blank" className="text-primary">
                @{bridgeUser.username} (score {bridgeUser.score})
              </a>
              {bridgeUser.avatarUrl && <img src={bridgeUser.avatarUrl || "/placeholder.svg"} alt={`${bridgeUser.username} avatar`} className="inline size-6 ml-2" width={24} height={24} />}
            </div>
          )}
          {bridgeAgents.length > 0 && (
            <div>
              <SectionLabel className="mb-1">Agents</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {bridgeAgents.map((id: number) => {
                  const isActive = tokenId === id
                  return (
                    <button
                      key={id}
                      onClick={() => { setTokenId(id); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-none text-xs transition-all border ${isActive ? "bg-primary text-primary-foreground border-primary" : "bg-secondary/50 hover:bg-secondary border-border"}`}
                    >
                      <img src={normieImageUrl(id)} alt={`Normie #${id}`} className="size-5 pixel-frame" width={20} height={20} />
                      <span className="font-mono">#{id}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {isMyAgent && (
        <div className="mx-auto text-center">
          <div className="inline-block text-sm tracking-[1.5px] border border-primary/60 px-4 py-1 rounded-none text-primary">
            Your Awakened Agent
            {isDelegateMatch && !isOwnerMatch && <span className="ml-1.5 text-[10px] normal-case tracking-normal text-primary/60">• via delegate</span>}
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
        <div style={{ display: 'contents' }}>
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

            {/* Zulo Recommends — Zulo's flagship agent skill */}
            {snapshot && (
              <div className="relative overflow-hidden rounded-none border border-primary/60 border-l-4 border-l-primary/70 bg-card/55 p-5 text-center shadow-sm">
                {/* Muted cosmic figure as background (scoped only to this section) */}
                <div
                  className="absolute inset-0 z-0 bg-cover bg-center pointer-events-none"
                  style={{ backgroundImage: `url('/images/7141art.png')`, opacity: 0.10 }}
                />
                {/* Soft dark gradient overlay for readability */}
                <div className="absolute inset-0 z-0 bg-gradient-to-b from-background/70 via-background/25 to-background/80 pointer-events-none" />

                {/* Content layer */}
                <div className="relative z-10">
                  <SectionLabel className="text-primary mb-1.5 tracking-[2px]">ZULO'S AGENT SKILL</SectionLabel>
                  
                  <h3 className="font-heading text-[26px] tracking-tight mb-2">Zulo Recommends</h3>
                  
                  <p className="text-[15px] text-muted-foreground max-w-md mx-auto mb-3 leading-snug">
                    Zulo analyzes your agent's on-chain data — its traits, canvas state, level, and activity — to surface the most relevant tools from the ecosystem.
                  </p>

                  <p className="text-[15px] text-muted-foreground mb-4 leading-snug">
                    {isConnected 
                      ? "These recommendations are personalized to help this specific agent grow." 
                      : "Connect your wallet to unlock Zulo's personalized recommendations for this agent."}
                  </p>

                  <Button 
                    onClick={handleZuloRecommendsClick}
                    variant="default"
                    className="glow-primary px-8 py-3 text-base font-medium"
                  >
                    <Sparkles className="size-4 mr-2" />
                    Ask Zulo for Recommendations
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Key Actions — card style buttons */}
          {snapshot && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Zulo Horizon Card */}
              <button
                onClick={() => setShowHorizonModal(true)}
                className="group glow-primary flex flex-col items-start gap-2 p-4 rounded-none border border-border bg-card hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm active:scale-[0.985] transition-all text-left"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  <span className="font-semibold">Zulo Horizon</span>
                </div>
                <p className="text-sm text-muted-foreground">Talk to your agent and get deeper insights.</p>
              </button>

              {/* Prove Linkage Card */}
              <button
                onClick={() => setShowLinkageModal(true)}
                className="group glow-primary flex flex-col items-start gap-2 p-4 rounded-none border border-border bg-card hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm active:scale-[0.985] transition-all text-left"
              >
                <div className="flex items-center gap-2">
                  <Fingerprint className="size-4 text-primary" />
                  <span className="font-semibold">Prove Linkage</span>
                </div>
                <p className="text-sm text-muted-foreground">Unlock full features by verifying your agent.</p>
              </button>

              {/* Browse Tools Card */}
              <button
                onClick={() => setShowToolsModal(true)}
                className="group glow-primary flex flex-col items-start gap-2 p-4 rounded-none border border-border bg-card hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm active:scale-[0.985] transition-all text-left"
              >
                <div className="flex items-center gap-2">
                  <Search className="size-4 text-primary" />
                  <span className="font-semibold">Browse Tools</span>
                </div>
                <p className="text-sm text-muted-foreground">Explore community-built tools for Normies.</p>
              </button>
            </div>
          )}

          {/* Zulo’s Credibility Framework */}
          <div className="mx-auto max-w-2xl mt-12 border-t border-border pt-10">
            <div className="flex flex-col items-center text-center">
              <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[2px] text-primary">
                <span className="h-px w-6 bg-primary/50" />
                Zulo’s Credibility Framework
                <span className="h-px w-6 bg-primary/50" />
              </span>
              <h2 className="font-heading text-2xl font-semibold leading-tight tracking-tight mt-3 text-balance sm:text-3xl">
                The on-chain signals that establish credibility for awakened agents.
              </h2>
              <p className="text-sm tracking-[1.5px] text-muted-foreground mt-2">— Analyzed by Zulo</p>
              <span className="mt-5 h-8 w-px bg-gradient-to-b from-primary/50 to-transparent" aria-hidden="true" />
            </div>

            <div className="cred-framework mt-2">
              {[
                {
                  signal: identitySignal,
                  icon: Boxes,
                  content: isLoading ? (
                    <Skeleton className="h-16 w-full" />
                  ) : snapshot?.agent?.agentId ? (
                    <div>
                      <div className="flex items-center gap-2 text-emerald-400">
                        <CircleCheck className="size-4" />
                        <span>Registered on-chain</span>
                      </div>
                      <div className="text-xs text-emerald-400/70 ml-6 mt-0.5">Agent #{snapshot.agent.agentId} recognized</div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        Registry: <a href={etherscanAddress(ERC8004.IDENTITY_REGISTRY)} target="_blank" className="font-mono hover:text-primary underline">{shortenAddress(ERC8004.IDENTITY_REGISTRY)}</a>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-amber-400">
                      <Clock className="size-4" />
                      <span>On-chain status pending</span>
                    </div>
                  ),
                },
                {
                  signal: ownershipSignal,
                  icon: Wallet,
                  content: isLoading || !snapshot ? (
                    <div className="space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /></div>
                  ) : (
                    <div className="space-y-2">
                      <div>
                        <div className="text-xs text-muted-foreground">OWNER</div>
                        <a href={etherscanAddress(snapshot.owner.owner)} target="_blank" className="font-mono text-foreground hover:text-primary">
                          {shortenAddress(snapshot.owner.owner, 6)}
                        </a>
                        {ownerUsername && <span className="text-primary text-xs ml-2">@{ownerUsername}</span>}
                      </div>
                      {delegate && !isZeroAddr(delegate) && (
                        <div>
                          <div className="text-xs text-muted-foreground">DELEGATE</div>
                          <a href={etherscanAddress(delegate)} target="_blank" className="font-mono text-foreground hover:text-primary">
                            {shortenAddress(delegate, 6)}
                          </a>
                          {delegateEnsName && <span className="text-primary text-xs ml-2">{delegateEnsName}</span>}
                        </div>
                      )}
                      {isMyAgent && delegate && !isZeroAddr(delegate) && (
                        <div className="text-xs text-muted-foreground pt-1 border-t border-border/60">
                          Cold storage → hot ENS (verifiable)
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  signal: canvasSignal,
                  icon: Palette,
                  content: isLoading || !snapshot ? (
                    <Skeleton className="h-16 w-full" />
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div>LVL {snapshot.canvas.level} • {snapshot.canvas.actionPoints} AP</div>
                        <div className="border px-1.5 py-px text-xs tracking-[1.5px]">
                          {snapshot.canvas.customized ? "CUSTOM" : "PRISTINE"}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-1 text-center text-sm">
                        <div>+{snapshot.canvasDiff.addedCount} <span className="text-muted-foreground">added</span></div>
                        <div>-{snapshot.canvasDiff.removedCount} <span className="text-muted-foreground">removed</span></div>
                        <div>{snapshot.canvasDiff.netChange} <span className="text-muted-foreground">net</span></div>
                      </div>
                    </div>
                  ),
                },
                {
                  signal: ethosSignal,
                  icon: ShieldCheck,
                  content: (
                    <EthosReputation
                      result={ethos}
                      isLoading={isLoading || ethosLoading}
                      error={ethosError}
                      address={ownerAddress ?? ""}
                      isMyAgent={isMyAgent}
                    />
                  ),
                },
                {
                  signal: externalSignal,
                  icon: Award,
                  content: isLoading || !snapshot ? (
                    <Skeleton className="h-16 w-full" />
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <div className="text-xs text-muted-foreground">AGENT TYPE</div>
                        <div className="font-medium">{agentType}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">GATE ACCESS</div>
                        <div className="font-medium">{isAgentType ? "Advanced" : "Limited"}</div>
                        <div className="text-xs text-muted-foreground">
                          {isAgentType ? "qualifies for advanced agent features" : "limited gate access"}
                        </div>
                      </div>
                      {ownerAddress && (
                        <div className="border-t border-border pt-3">
                          <div className="mb-2 text-xs text-muted-foreground">AGENTCHECK · WALLET TRUST</div>
                          <AgentCheckCard
                            result={agentCheck}
                            isLoading={agentCheckLoading}
                            address={ownerAddress}
                          />
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  signal: wireSignal,
                  icon: Layers,
                  content: (
                    <>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="size-4" />
                        <span>Coming soon — Wire UTL integration</span>
                      </div>
                      <p className="text-sm leading-relaxed text-muted-foreground mt-2 text-pretty">
                        Verifiable execution history, settlement certainty, and cross-chain reliability will appear here when Wire integration is live.
                      </p>
                    </>
                  ),
                },
                {
                  signal: toolRegistrySignal,
                  icon: Wrench,
                  content: (
                    <>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="size-4" />
                        <span>Coming soon – ERC-8257 tooling</span>
                      </div>
                      <p className="text-sm leading-relaxed text-muted-foreground mt-2 text-pretty">
                        Today the ecosystem tools are a curated list. ERC-8257 (draft) turns them into a permissionless on-chain registry — each tool content-addressed and verifiable, with access gated by predicate contracts like awakened-agent ownership. The framework is already schema-ready for it.
                      </p>
                    </>
                  ),
                },
              ].map((section, index) => (
                <Fragment key={section.signal.id}>
                  {index > 0 && <CredibilityConnector />}
                  <CredibilitySignal signal={section.signal} icon={section.icon}>
                    {section.content}
                  </CredibilitySignal>
                </Fragment>
              ))}
            </div>

            <p className="text-center text-sm leading-relaxed text-muted-foreground mt-6 max-w-prose mx-auto text-pretty">
              As the ecosystem grows, these signals may become more useful for understanding and interacting with awakened agents.
            </p>
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
                      }}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-none text-xs border transition-all ${tokenId === id ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-card'}`}
                    >
                      <img src={normieImageUrl(id)} alt={`#${id}`} className="size-4 pixel-frame" width={16} height={16} />
                      <span>#{id}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          <ToolsModal isOpen={showToolsModal} onClose={() => setShowToolsModal(false)} />
          <AgentHorizonModal 
            tokenId={tokenId} 
            isMyAgent={isMyAgent} 
            open={showHorizonModal}
            onOpenChange={setShowHorizonModal}
          />
          <LinkageProofModal 
            tokenId={tokenId} 
            ownerAddress={snapshot?.owner.owner || ""} 
            delegateAddress={snapshot?.canvas.delegate} 
            open={showLinkageModal}
            onOpenChange={setShowLinkageModal}
          />
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
        </div>
      )}
    </div>
  )
}
