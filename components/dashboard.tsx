"use client"

import { EvolutionTrack } from "@/components/evolution-track"
import { PulseHero } from "@/components/pulse-hero"
import { useRecordCard } from "@/hooks/use-record-card"
import { Erc8004Card } from "@/components/erc8004-card"
import { EthosReputation } from "@/components/ethos-reputation"
import { LinkageProofModal } from "@/components/linkage-proof-modal"
import { OwnershipCard } from "@/components/ownership-card"
import { ToolsModal } from "@/components/tools-modal"
import { Erc8257RegistryPanel } from "@/components/erc8257-registry-panel"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { SectionLabel } from "@/components/ui/section-label"
import { useActiveNormie } from "@/components/active-normie-provider"
import { MyAgentsPanel } from "@/components/my-agents-panel"
import { useAgentCheck, useEthosScore, useNormie } from "@/hooks/use-normie"
import { AgentCheckCard } from "@/components/agentcheck-card"
import { ChatRatingsCard } from "@/components/chat-ratings-card"
import { useChatRatings } from "@/hooks/use-chat-ratings"
import { AlertTriangle, Award, Boxes, CircleCheck, Clock, Layers, MessageSquareText, Palette, ShieldCheck, Wallet, Wrench } from "lucide-react"
import { useState, useEffect } from "react"
import { useAccount } from "wagmi"
import { normieImageUrl } from "@/lib/api/normies"
import { useMyNormies } from "@/hooks/use-my-normies"
import { useWalletGate } from "@/components/wallet-gate"
import { useEnsName } from "@/hooks/use-ens-name"
import {
  controlsNormie,
  getResolvedAgentId,
  isAwakenedFromSnapshot,
  isCanvasDelegate,
  isNormieOwner,
  isZeroAddress,
} from "@/lib/normie-control"

import { Skeleton } from "@/components/ui/skeleton"
import {
  PulseAccordion,
  PulseAccordionItem,
} from "@/components/pulse-accordion"
import { ERC8004, ZULO } from "@/constants/contracts"
import { etherscanAddress, shortenAddress } from "@/lib/format"
import { getCurrentSignals, validateSignals } from "@/lib/signals"

export function Dashboard() {
  const { address, isConnected } = useAccount()
  const { requireWallet, promptConnect } = useWalletGate()
  const {
    activeTokenId,
    setActiveTokenId,
    controlledNormies: myNormies,
  } = useActiveNormie()
  /** Dashboard showcase: Active Normie when connected, else Zulo identity piece. */
  const tokenId = activeTokenId ?? ZULO.tokenId

  const [myInput, setMyInput] = useState<string>("")

  const [showToolsModal, setShowToolsModal] = useState(false)
  const [toolsModalTab, setToolsModalTab] = useState<"normies" | "erc8257">("normies")
  const [showLinkageModal, setShowLinkageModal] = useState(false)

  const { data: snapshot, isLoading, isError } = useNormie(tokenId)
  const { data: recordCard } = useRecordCard(tokenId)
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

  const isAwakened = isAwakenedFromSnapshot(snapshot)
  const resolvedAgentId = getResolvedAgentId(snapshot?.agent, snapshot?.binding)

  const {
    data: chatRatings,
    isLoading: chatRatingsLoading,
    isError: chatRatingsError,
  } = useChatRatings(resolvedAgentId)

  const rawFrameworkSignals = getCurrentSignals({ snapshot, ethos, ownerAddress, chatRatings })
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
    chatRatingsSignal,
  ] = frameworkSignals

  const delegate = snapshot?.canvas?.delegate

  const isOwnerMatch =
    isConnected && isNormieOwner(address, ownerAddress)
  const isDelegateMatch =
    isConnected && isCanvasDelegate(address, delegate)

  // Owner or Canvas delegate — same feature access for both.
  const isMyAgent = controlsNormie(address, ownerAddress, delegate)

  const walletForAccess =
    isMyAgent && isConnected && address
      ? address
      : ownerAddress ?? undefined

  const { data: delegateEnsName } = useEnsName(
    !isZeroAddress(delegate) ? delegate : undefined
  )

  const { data: ownerAgents = [] } = useMyNormies(ownerAddress)

  function selectNormie(id: number) {
    setActiveTokenId(id)
  }

  function loadMyAgent() {
    const parsed = Number.parseInt(myInput, 10)
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 9999) {
      selectNormie(parsed)
      setMyInput("")
    }
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-10 sm:gap-14">
      {/* Hero — live Pulse heartbeat, trust gate, record card */}
      <PulseHero
        tokenId={tokenId}
        tagline={snapshot?.agent?.tagline ?? null}
        isMyAgent={isMyAgent}
        viaDelegate={isDelegateMatch && !isOwnerMatch}
        isConnected={isConnected}
        onConnect={() => promptConnect("Connect your wallet to see the Normies you own or control.")}
        onProveLinkage={
          snapshot && !isError
            ? () =>
                requireWallet(
                  () => setShowLinkageModal(true),
                  "Proving linkage signs a message with your wallet to verify you control this agent.",
                )
            : undefined
        }
        onBrowseTools={() => {
          setToolsModalTab("normies")
          setShowToolsModal(true)
        }}
      />

      {/* Trust → Record → Skill */}
      <EvolutionTrack
        tokenId={tokenId}
        level={recordCard?.pulse.available ? recordCard.pulse.level : null}
        maxLevel={recordCard?.pulse.max_level ?? 5}
        gatePassed={recordCard?.pulse.available ? recordCard.pulse.gate.passed : null}
      />

      {/* Your agents — switcher and manual lookup */}
      <section className="pulse-agents" aria-label="Your agents">
        <MyAgentsPanel />

        {isConnected && (
          <div className="pulse-lookup">
            <label htmlFor="token-id-input" className="pulse-lookup-label">Look up any Normie</label>
            <div className="flex w-full max-w-sm items-center gap-2">
              <input
                id="token-id-input"
                value={myInput}
                onChange={(e) => setMyInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") loadMyAgent() }}
                inputMode="numeric"
                placeholder="Token id, 0–9999"
                className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none border-b border-border py-2 focus:border-primary transition-colors"
              />
              <Button onClick={loadMyAgent} variant="ghost" size="sm" className="text-sm">Load</Button>
            </div>
          </div>
        )}

      </section>

      {isError ? (
        <Card className="border-destructive/40">
          <CardContent className="flex flex-col items-start gap-3 py-12 text-left">
            <AlertTriangle className="size-8 text-destructive" />
            <p className="font-medium">Couldn&apos;t load the details for Normie #{tokenId}</p>
            <p className="max-w-sm text-sm text-muted-foreground">Check the token id, or pick another agent above.</p>
          </CardContent>
        </Card>
      ) : (
        <div style={{ display: 'contents' }}>
          {/* Credibility Framework — collapsible signal sections */}
          <div className="cred-framework-acc w-full min-w-0">
            <div className="cred-framework-intro">
              <h2 className="cred-framework-heading">
                Every signal, in detail
              </h2>
              <p className="cred-framework-sub">
                What sits behind each beat, plus outside reputation. Open a section to see the source.
              </p>
            </div>

            <PulseAccordion defaultOpenIds={[]} allowMultiple className="mt-4">
              {[
                {
                  signal: identitySignal,
                  icon: Boxes,
                  content: isLoading ? (
                    <Skeleton className="h-16 w-full" />
                  ) : resolvedAgentId ? (
                    <div>
                      <div className="flex items-center gap-2 text-foreground">
                        <CircleCheck className="size-4" />
                        <span>Registered on-chain</span>
                      </div>
                      <div className="text-xs text-muted-foreground ml-6 mt-0.5">Agent #{resolvedAgentId} recognized</div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        Registry: <a href={etherscanAddress(ERC8004.IDENTITY_REGISTRY)} target="_blank" rel="noopener noreferrer" className="font-mono hover:text-primary underline">{shortenAddress(ERC8004.IDENTITY_REGISTRY)}</a>
                      </div>
                      {snapshot?.traits?.attributes?.length ? (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {snapshot.traits.attributes.slice(0, 8).map((t: any, i: number) => (
                            <div key={i} className="bg-secondary/60 px-2 py-px text-xs text-muted-foreground">
                              {t.trait_type}: <span className="text-foreground">{t.value}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-foreground">
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
                        <a href={etherscanAddress(snapshot.owner.owner)} target="_blank" rel="noopener noreferrer" className="font-mono text-foreground hover:text-primary">
                          {shortenAddress(snapshot.owner.owner, 6)}
                        </a>
                        {ownerUsername && <span className="text-primary text-xs ml-2">@{ownerUsername}</span>}
                      </div>
                      {delegate && !isZeroAddress(delegate) && (
                        <div>
                          <div className="text-xs text-muted-foreground">DELEGATE</div>
                          <a href={etherscanAddress(delegate)} target="_blank" rel="noopener noreferrer" className="font-mono text-foreground hover:text-primary">
                            {shortenAddress(delegate, 6)}
                          </a>
                          {delegateEnsName && <span className="text-primary text-xs ml-2">{delegateEnsName}</span>}
                        </div>
                      )}
                      {isMyAgent && delegate && !isZeroAddress(delegate) && (
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
                        <div>Level {snapshot.canvas.level} · {snapshot.canvas.actionPoints} action points</div>
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
                  signal: chatRatingsSignal,
                  icon: MessageSquareText,
                  content: (
                    <ChatRatingsCard
                      summary={chatRatings}
                      isLoading={isLoading || chatRatingsLoading}
                      isError={chatRatingsError}
                      agentId={resolvedAgentId}
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
                        <div className="font-medium">{isAwakened ? "Full Access" : "Limited"}</div>
                        {!isAwakened && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Awaken your Normie at{" "}
                            <a
                              href="https://normies.art/lab"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              normies.art/lab
                            </a>{" "}
                            to unlock full access.
                          </p>
                        )}
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
                        <span>Idea, not built</span>
                      </div>
                      <p className="text-sm leading-relaxed text-muted-foreground mt-2 text-pretty">
                        Execution history from Wire could appear here one day, but only if an official, readable data source exists. Nothing is planned or scheduled.
                      </p>
                    </>
                  ),
                },
                {
                  signal: toolRegistrySignal,
                  icon: Wrench,
                  content: (
                    <Erc8257RegistryPanel
                      walletAddress={walletForAccess}
                      onBrowseAll={() => {
                        setToolsModalTab("erc8257")
                        setShowToolsModal(true)
                      }}
                    />
                  ),
                },
              ].map((section) => {
                const Icon = section.icon
                return (
                  <PulseAccordionItem
                    key={section.signal.id}
                    id={section.signal.id}
                    title={section.signal.title}
                    subtitle={section.signal.description}
                  >
                    <div className="flex gap-3 min-w-0">
                      <div className="cred-icon flex h-8 w-8 shrink-0 items-center justify-center border border-primary bg-primary/10">
                        <Icon className="size-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1 cred-data">{section.content}</div>
                    </div>
                  </PulseAccordionItem>
                )
              })}
            </PulseAccordion>

            <p className="mt-6 max-w-prose text-left text-sm leading-relaxed text-pretty text-muted-foreground">
              As the ecosystem grows, these signals may become more useful for understanding and interacting with awakened agents.
            </p>
          </div>

          {/* Linked agents via owner — same left column as Moves */}
          {snapshot && ownerAgents.length > 1 && (() => {
            const siblings = ownerAgents.filter((n) => n.tokenId !== tokenId).slice(0, 8);
            if (siblings.length === 0) return null;
            return (
              <div className="text-left">
                <SectionLabel className="mb-2">Also Linked Via Owner</SectionLabel>
                <div className="flex flex-wrap justify-start gap-1.5">
                  {siblings.map((normie) => (
                    <button
                      key={normie.tokenId}
                      onClick={() => {
                        selectNormie(normie.tokenId);
                      }}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-none text-xs border transition-all ${tokenId === normie.tokenId ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-card'}`}
                    >
                      <img src={normieImageUrl(normie.tokenId)} alt={`#${normie.tokenId}`} className="size-4 pixel-frame" width={16} height={16} />
                      <span>#{normie.tokenId}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          <LinkageProofModal 
            tokenId={tokenId} 
            ownerAddress={snapshot?.owner.owner || ""} 
            delegateAddress={snapshot?.canvas.delegate} 
            open={showLinkageModal}
            onOpenChange={setShowLinkageModal}
          />
        </div>
      )}

      <ToolsModal
        isOpen={showToolsModal}
        onClose={() => setShowToolsModal(false)}
        initialTab={toolsModalTab}
        walletAddress={walletForAccess}
      />
    </div>
  )
}
