"use client"

import { AgentCard } from "@/components/agent-card"
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
import { fetchEthosByUsername } from "@/lib/api/ethos"
import { AlertTriangle, Award, Boxes, CircleCheck, Clock, Fingerprint, Layers, Palette, Search, ShieldCheck, Wallet, Wrench } from "lucide-react"
import { Fragment, useState, useEffect } from "react"
import { useAccount, useSignMessage } from "wagmi"
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
import { CredibilityConnector, CredibilitySignal } from "@/components/credibility-signal"
import { ERC8004 } from "@/constants/contracts"
import { etherscanAddress, shortenAddress } from "@/lib/format"
import { getCurrentSignals, validateSignals } from "@/lib/signals"

export function Dashboard() {
  const { address, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const { requireWallet, promptConnect } = useWalletGate()
  const {
    activeTokenId: tokenId,
    setActiveTokenId,
    controlledNormies: myNormies,
  } = useActiveNormie()

  const [myInput, setMyInput] = useState<string>("")

  // Bridge search state
  const [bridgeAddress, setBridgeAddress] = useState<string>("")
  const [bridgeUsername, setBridgeUsername] = useState<string>("")
  const [bridgeUser, setBridgeUser] = useState<any>(null)

  const [endorseResult, setEndorseResult] = useState<{ message: string; signature?: string } | null>(null)
  const [showToolsModal, setShowToolsModal] = useState(false)
  const [toolsModalTab, setToolsModalTab] = useState<"normies" | "erc8257">("normies")
  const [showLinkageModal, setShowLinkageModal] = useState(false)

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

  const isAwakened = isAwakenedFromSnapshot(snapshot)
  const resolvedAgentId = getResolvedAgentId(snapshot?.agent, snapshot?.binding)

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
  const { data: bridgeAgents = [] } = useMyNormies(bridgeAddress || undefined)

  function selectNormie(id: number) {
    setActiveTokenId(id)
  }

  function loadMyAgent() {
    const parsed = Number.parseInt(myInput, 10)
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 9999) {
      selectNormie(parsed)
      setMyInput("")
      setBridgeAddress("")
      setBridgeUsername("")
      setBridgeUser(null)
    }
  }

  async function handleEndorse(targetId: number) {
    if (!address || myNormies.length === 0) return
    const endorserId = myNormies[0].tokenId
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

  function Metric({ label, value }: { label: string; value: string }) {
    return (
      <div className="flex flex-col items-center py-2.5">
        <span className="font-heading text-lg font-bold tabular-nums tracking-[-1px]">{value}</span>
        <span className="text-xs tracking-[1.5px] text-muted-foreground">{label}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto pixel-texture sm:gap-10">
      {/* Search bar — manual Normie lookup */}
      {isConnected && (
        <div className="rounded-none border border-border bg-card/70 p-4 sm:p-5">
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

      {/* My agents — controlled / delegated multi-Normie switcher */}
      <MyAgentsPanel />

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
                {bridgeAgents.map((normie) => {
                  const isActive = tokenId === normie.tokenId
                  return (
                    <button
                      key={normie.tokenId}
                      onClick={() => { selectNormie(normie.tokenId) }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-none text-xs transition-all border ${isActive ? "bg-primary text-primary-foreground border-primary" : "bg-secondary/50 hover:bg-secondary border-border"}`}
                    >
                      <img src={normieImageUrl(normie.tokenId)} alt={`Normie #${normie.tokenId}`} className="size-5 pixel-frame" width={20} height={20} />
                      <span className="font-mono">#{normie.tokenId}</span>
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
        <div className="flex flex-col items-center gap-3 text-center max-w-xs mx-auto">
          <p className="text-sm text-muted-foreground">
            Connect your wallet to unlock your agent&apos;s full view. Use Moves or Ask for Zulo guidance.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() =>
              promptConnect("Connect your wallet to unlock your agent's full dashboard view.")
            }
          >
            <Wallet className="size-4" />
            Connect wallet
          </Button>
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
          </div>

          {/* Key Actions — card style buttons */}
          {snapshot && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Prove Linkage Card */}
              <button
                onClick={() =>
                  requireWallet(
                    () => setShowLinkageModal(true),
                    "Proving linkage signs a message with your wallet to verify you control this agent.",
                  )
                }
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
                onClick={() => {
                  setToolsModalTab("normies")
                  setShowToolsModal(true)
                }}
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
          <div className="mx-auto w-full min-w-0 max-w-2xl mt-12 border-t border-border pt-10">
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
                  ) : resolvedAgentId ? (
                    <div>
                      <div className="flex items-center gap-2 text-emerald-400">
                        <CircleCheck className="size-4" />
                        <span>Registered on-chain</span>
                      </div>
                      <div className="text-xs text-emerald-400/70 ml-6 mt-0.5">Agent #{resolvedAgentId} recognized</div>
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
                      {delegate && !isZeroAddress(delegate) && (
                        <div>
                          <div className="text-xs text-muted-foreground">DELEGATE</div>
                          <a href={etherscanAddress(delegate)} target="_blank" className="font-mono text-foreground hover:text-primary">
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
                    <Erc8257RegistryPanel
                      walletAddress={walletForAccess}
                      onBrowseAll={() => {
                        setToolsModalTab("erc8257")
                        setShowToolsModal(true)
                      }}
                    />
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
            const siblings = ownerAgents.filter((n) => n.tokenId !== tokenId).slice(0, 8);
            if (siblings.length === 0) return null;
            return (
              <div className="text-center">
                <SectionLabel className="mb-2">Also Linked Via Owner</SectionLabel>
                <div className="flex flex-wrap justify-center gap-1.5">
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

          <ToolsModal
            isOpen={showToolsModal}
            onClose={() => setShowToolsModal(false)}
            initialTab={toolsModalTab}
            walletAddress={walletForAccess}
          />
          <LinkageProofModal 
            tokenId={tokenId} 
            ownerAddress={snapshot?.owner.owner || ""} 
            delegateAddress={snapshot?.canvas.delegate} 
            open={showLinkageModal}
            onOpenChange={setShowLinkageModal}
          />
        </div>
      )}
    </div>
  )
}
