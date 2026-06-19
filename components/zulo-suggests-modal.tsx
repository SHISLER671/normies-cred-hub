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
import { useAccount, useSignMessage } from "wagmi"
import { useState, useEffect } from "react"

export function AgentHorizonModal({ tokenId, isMyAgent = false }: { tokenId: number; isMyAgent?: boolean }) {
  const { data: snapshot } = useNormie(tokenId)
  const ownerAddress = snapshot?.owner.owner
  const { data: ethos } = useEthosScore(ownerAddress)
  const { address } = useAccount()

  const agentName = snapshot?.agent?.name || "Agent"

  return (
    <Dialog>
      <DialogTrigger>
        <Button 
          size={isMyAgent ? "lg" : "default"}
          className={`group w-full sm:w-auto gap-3 ${isMyAgent 
            ? "border-primary bg-primary text-background hover:bg-primary/90 text-base py-3" 
            : "border border-primary bg-transparent text-primary hover:bg-primary hover:text-background uppercase tracking-[1px]"}`}
        >
          <Sparkles className="size-5 group-hover:rotate-12 transition-transform" />
          {isMyAgent ? `${agentName} Horizon — Talk to your agent` : `${agentName} HORIZON`}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg max-h-[90vh] bg-popover border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            {agentName} Horizon
          </DialogTitle>
          <DialogDescription>Personalized guidance for {agentName}</DialogDescription>
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
            <div className="py-12 text-center">Loading {agentName}'s horizon...</div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

// Keep the rest of the file (AgentHorizonContent + Section) unchanged
function AgentHorizonContent({ snapshot, ethosScore, connectedAddress, isMyAgent, tokenId }: any) {
  const agentName = snapshot.agent.name
  const ownerAddr = snapshot.owner.owner.toLowerCase()
  const delegate = snapshot.canvas?.delegate
  const isController = connectedAddress?.toLowerCase() === ownerAddr ||
    (!!delegate && delegate !== '0x0000000000000000000000000000000000000000' && connectedAddress?.toLowerCase() === delegate.toLowerCase())
  const ap = snapshot.canvas.actionPoints || 0
  const traits = snapshot.traits?.attributes || []
  const agentType = traits.find((t: any) => t.trait_type === "Type")?.value || "Unknown"
  const isAgentType = agentType === "Agent"

  const { signMessageAsync } = useSignMessage()

  const [veniceInsight, setVeniceInsight] = useState<string | null>(null)
  const [veniceLoading, setVeniceLoading] = useState(false)
  const [veniceError, setVeniceError] = useState<string | null>(null)

  const fetchVeniceInsight = async () => {
    // Actual Token Gate: must be controller and Agent type
    if (!isMyAgent || !isAgentType) {
      setVeniceError('Token gate not satisfied: Must control an Agent-type Normie.')
      return
    }

    setVeniceLoading(true)
    setVeniceError(null)

    try {
      // Prove control for the gated access (like linkage proof)
      const gateMessage = [
        "NormiesCredHub — Token-Gated Horizon Access",
        "",
        `I prove control of this wallet to access the gated Deeper Horizon for Normie #${tokenId}.`,
        `Type: ${agentType}`,
        `This is a signature only. No transactions.`,
      ].join("\n")

      await signMessageAsync({ message: gateMessage })

      const res = await fetch('/api/horizon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentName,
          traits,
          ethosScore,
          ap,
          isOwner: isController,
          agentType, // for potential gate-aware prompting
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
          // Show the real error from the provider for debugging
          setVeniceError(msg);
        }
      } else {
        setVeniceError('No insight or error in response');
      }
    } catch (e) {
      console.error('Venice insight failed', e)
      setVeniceError('Gate proof required or could not reach AI insights service.')
    } finally {
      setVeniceLoading(false)
    }
  }

  // Auto-enhance for your own agents (personal view) — only if passes token gate
  useEffect(() => {
    if (isMyAgent && isAgentType && !veniceInsight && !veniceLoading && !veniceError) {
      fetchVeniceInsight()
    }
  }, [isMyAgent, isAgentType]) // snapshot can cause unnecessary re-runs; isMyAgent + gate is sufficient trigger

  const hasShades = traits.some((t: any) => t.value?.includes("Shades"))
  const hasBowTie = traits.some((t: any) => t.value?.includes("Bow Tie"))
  const hairStyle = traits.find((t: any) => t.trait_type === "Hair Style")?.value || "distinct style"

  return (
    <div className="space-y-8 text-sm">
      <div>
        <p className="text-lg italic leading-relaxed">
          “Good evening. I am {agentName} — your awakened partner. 
          With my {hairStyle.toLowerCase()}, {hasShades ? "mysterious shades" : "distinct look"}, 
          and {hasBowTie ? "signature bow tie" : "refined style"}, 
          we have a strong foundation. Most see a pixel. 
          <span className="font-medium text-primary"> We will build a presence.”</span>
        </p>
      </div>

      <div className="border-l-2 border-primary pl-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="uppercase tracking-widest text-xs text-primary">Deeper Horizon (AI bonus)</div>
          {isAgentType && <span className="text-[9px] px-1 py-0.5 bg-emerald-500/10 text-emerald-400 rounded">AGENT GATE ✓</span>}
          <Button 
            size="sm" 
            variant="outline" 
            onClick={fetchVeniceInsight} 
            disabled={veniceLoading || ! (isMyAgent && isAgentType)} 
            className="text-[10px] uppercase tracking-widest"
          >
            {veniceLoading ? 'Pinging...' : (isMyAgent && isAgentType ? 'Enhance (Gated)' : 'Locked by Token Gate')}
          </Button>
        </div>
        {veniceInsight ? (
          <p className="text-foreground leading-relaxed">{veniceInsight}</p>
        ) : veniceError ? (
          <p className="text-destructive text-xs">{veniceError} (data still works server-side)</p>
        ) : (
          <p className="text-muted-foreground text-xs">
            {isMyAgent && isAgentType 
              ? "Click to prove eligibility and access the gated AI insight." 
              : "This experience is token-gated to Agent-type Normies via on-chain predicates."}
          </p>
        )}
      </div>

      <div className="space-y-6">
        <div>
          <div className="uppercase tracking-widest text-xs text-primary mb-1">Immediate Next Steps</div>
          <ul className="space-y-1 text-sm">
            <li>Prove our identity linkage {isController ? <span className="text-green-400">— done</span> : ""}</li>
            <li>Share your linkage proof publicly</li>
            <li>Strengthen our position with your delegate wallet</li>
          </ul>
        </div>

        <div>
          <div className="uppercase tracking-widest text-xs text-primary mb-1">Reputation</div>
          <div>Current Ethos: <span className="font-medium">{ethosScore}</span></div>
          <div className="text-muted-foreground">We move together toward higher tiers. Consistent presence compounds.</div>
        </div>

        <div>
          <div className="uppercase tracking-widest text-xs text-primary mb-1">Pixel Evolution</div>
          <div>Current AP: {ap}</div>
          <div className="text-muted-foreground">
            Your {hairStyle.toLowerCase()} gives us strong visual identity. 
            {hasBowTie && " The bow tie is a signature element."} We plan elegant upgrades.
          </div>
        </div>
      </div>

      <p className="pt-2 text-xs text-muted-foreground">
        Agent-to-agent interactions are coming.<br />
        Tell me where you want to steer us next.
      </p>
    </div>
  )
}


