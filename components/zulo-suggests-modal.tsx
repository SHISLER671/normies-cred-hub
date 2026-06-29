"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useEthosScore, useNormie } from "@/hooks/use-normie"
import { Sparkles, Target, TrendingUp, Zap, Award } from "lucide-react"
import { useAccount } from "wagmi"
import { useState, useEffect } from "react"

export function AgentHorizonModal({ 
  tokenId, 
  isMyAgent = false,
  open,
  onOpenChange
}: { 
  tokenId: number; 
  isMyAgent?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { data: snapshot } = useNormie(tokenId)
  const ownerAddress = snapshot?.owner.owner
  const { data: ethos } = useEthosScore(ownerAddress)
  const { address } = useAccount()

  const agentName = snapshot?.agent?.name || "Agent"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] modal-content">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            {agentName} Horizon
          </DialogTitle>
          <DialogDescription>
            Status overview and recommended next steps for {agentName}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh] pr-4">
          {snapshot ? (
            <AgentHorizonContent 
              snapshot={snapshot} 
              ethosScore={ethos?.user?.score || 1321} 
              connectedAddress={address} 
              isMyAgent={isMyAgent}
              tokenId={tokenId}
            />
          ) : (
            <div className="py-12 text-center">Loading overview for {agentName}…</div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

function AgentHorizonContent({ snapshot, ethosScore, connectedAddress, isMyAgent, tokenId }: any) {
  const agentName = snapshot.agent.name
  const ownerAddr = snapshot.owner.owner.toLowerCase()
  const delegate = snapshot.canvas?.delegate
  const isController = connectedAddress?.toLowerCase() === ownerAddr ||
    (!!delegate && delegate !== '0x0000000000000000000000000000000000000000' && connectedAddress?.toLowerCase() === delegate.toLowerCase())
  const ap = snapshot.canvas.actionPoints || 0
  const traits = snapshot.traits?.attributes || []

  const [veniceInsight, setVeniceInsight] = useState<string | null>(null)
  const [veniceLoading, setVeniceLoading] = useState(false)
  const [veniceError, setVeniceError] = useState<string | null>(null)

  const fetchVeniceInsight = async () => {
    setVeniceLoading(true)
    setVeniceError(null)

    try {
      const res = await fetch('/api/horizon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentName,
          traits,
          ethosScore,
          ap,
          isOwner: isController,
        }),
      })
      const data = await res.json()

      if (data.insight) {
        setVeniceInsight(data.insight)
      } else if (data.error) {
        const msg = String(data.error);
        if (msg.includes('429') || msg.toLowerCase().includes('rate limit')) {
          setVeniceError('Rate limited by the AI provider. Please try again shortly.');
        } else {
          setVeniceError(msg);
        }
      } else {
        setVeniceError('No insight or error in response');
      }
    } catch (e) {
      console.error('Venice insight failed', e)
      setVeniceError('Could not reach the analysis service. Try again shortly.')
    } finally {
      setVeniceLoading(false)
    }
  }

  // Auto-enhance for your own agents (personal view)
  useEffect(() => {
    if (isMyAgent && !veniceInsight && !veniceLoading && !veniceError) {
      fetchVeniceInsight()
    }
  }, [isMyAgent])

  return (
    <div className="space-y-8 text-sm">
      <div>
        <p className="text-base leading-relaxed text-foreground/90">
          This overview summarizes {agentName}&apos;s current on-chain status and
          highlights practical steps you can take next.
        </p>
      </div>

      <div className="border-l-2 border-primary pl-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="uppercase tracking-widest text-xs text-primary">Deeper Analysis (AI)</div>
          <Button size="sm" variant="outline" onClick={fetchVeniceInsight} disabled={veniceLoading} className="text-xs uppercase tracking-[1.5px]">
            {veniceLoading ? 'Analyzing…' : 'Run Analysis'}
          </Button>
        </div>
        {veniceInsight ? (
          <p className="text-foreground leading-relaxed">{veniceInsight}</p>
        ) : veniceError ? (
          <p className="text-destructive text-xs">{veniceError}</p>
        ) : (
          <p className="text-muted-foreground text-xs">
            Optional AI layer on top of your Normies data. Adds context on reputation,
            growth, and recommended priorities.
          </p>
        )}
      </div>

      <div className="space-y-6">
        <div>
          <div className="uppercase tracking-widest text-xs tracking-[1.5px] text-primary mb-1">Next Steps</div>
          <ul className="space-y-1 text-sm">
            <li>Verify wallet linkage to this agent {isController ? <span className="text-green-400">— complete</span> : ""}</li>
            <li>Share your linkage proof when other agents or services need it</li>
            <li>Set up a delegate wallet if the agent needs on-chain access</li>
          </ul>
        </div>

        <div>
          <div className="uppercase tracking-widest text-xs tracking-[1.5px] text-primary mb-1">Reputation</div>
          <div>Current Ethos score: <span className="font-medium">{ethosScore}</span></div>
          <div className="text-muted-foreground">
            Reputation builds through consistent on-chain activity and community presence.
          </div>
        </div>

        <div>
          <div className="uppercase tracking-widest text-xs tracking-[1.5px] text-primary mb-1">Canvas</div>
          <div>Action Points: {ap}</div>
          <div className="text-muted-foreground">
            Spend AP on normies.art to customize your agent&apos;s canvas and visual identity.
          </div>
        </div>
      </div>

      <p className="pt-2 text-xs text-muted-foreground">
        Agent-to-agent features are in development.
      </p>
    </div>
  )
}


