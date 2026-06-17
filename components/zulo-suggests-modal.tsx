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

export function AgentHorizonModal({ tokenId }: { tokenId: number }) {
  const { data: snapshot } = useNormie(tokenId)
  const ownerAddress = snapshot?.owner.owner
  const { data: ethos } = useEthosScore(ownerAddress)
  const { address } = useAccount()

  const agentName = snapshot?.agent?.name || "Agent"

  return (
    <Dialog>
      <DialogTrigger>
        <Button 
          size="lg" 
          className="group w-full sm:w-auto gap-3 border border-primary bg-transparent text-primary hover:bg-primary hover:text-background uppercase tracking-[1px]"
        >
          <Sparkles className="size-5 group-hover:rotate-12 transition-transform" />
          {agentName} HORIZON
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg max-h-[90vh] bg-popover border-border">
        {/* ... rest of modal stays the same ... */}
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
function AgentHorizonContent({ snapshot, ethosScore, connectedAddress }: any) {
  const agentName = snapshot.agent.name
  const isOwner = connectedAddress?.toLowerCase() === snapshot.owner.owner.toLowerCase()
  const ap = snapshot.canvas.actionPoints || 0
  const traits = snapshot.traits?.attributes || []

  const hasShades = traits.some((t: any) => t.value?.includes("Shades"))
  const hasBowTie = traits.some((t: any) => t.value?.includes("Bow Tie"))
  const hairStyle = traits.find((t: any) => t.trait_type === "Hair Style")?.value || "distinct style"

  return (
    <div className="space-y-8 text-sm">
      <div className="rounded-2xl border border-primary/40 bg-[#1a1a1a] p-6">
        <p className="italic leading-relaxed text-foreground">
          "Good evening. I am {agentName} — your awakened partner. 
          With my {hairStyle.toLowerCase()}, {hasShades ? "mysterious shades" : "distinct look"}, 
          and {hasBowTie ? "signature bow tie" : "refined style"}, 
          we have a strong foundation. Most see a pixel. 
          <span className="font-semibold text-primary">We will build a presence."</span>
        </p>
      </div>

      {/* Keep the rest of your sections the same */}
      <Section title="Immediate Next Steps" icon={Target}>
        <ul className="space-y-3">
          <li className="flex justify-between">
            <span>Prove our identity linkage</span>
            {isOwner ? <span className="text-green-400">✓ Confirmed</span> : <span className="text-amber-400">Action needed</span>}
          </li>
          <li>• Share your linkage proof publicly</li>
          <li>• Your delegate wallet strengthens our position</li>
        </ul>
      </Section>

      <Section title="Reputation — Our Foundation" icon={TrendingUp}>
        <p className="text-xs text-muted-foreground mb-3">Current Ethos: {ethosScore}</p>
        <ul className="space-y-2">
          <li>• We move together toward higher reputation tiers</li>
          <li>• Consistent presence compounds</li>
          <li className="text-primary">• Goal: Become a respected Human-Agent pair</li>
        </ul>
      </Section>

      <Section title="Pixel Evolution" icon={Zap}>
        <p className="text-xs text-muted-foreground mb-3">Current AP: {ap}</p>
        <ul className="space-y-2">
          <li>• Your {hairStyle.toLowerCase()} gives us strong visual identity</li>
          {hasBowTie && <li>• The bow tie is a signature element</li>}
          <li>• We plan elegant upgrades when AP becomes available</li>
        </ul>
      </Section>

      <Section title="The Horizon Ahead" icon={Award}>
        <ul className="space-y-3">
          <li>• Agent-to-agent interactions are coming</li>
          <li>• We are early, serious participants</li>
        </ul>
      </Section>

      <p className="text-center text-xs text-muted-foreground pt-4">
        This is the beginning of our shared journey.<br />
        Tell me where you want to steer us next.
      </p>
    </div>
  )
}

function Section({ title, icon: Icon, children }: any) {
  return (
    <div className="rounded-2xl border border-border bg-[#1a1a1a] p-5">
      <h4 className="flex items-center gap-2 font-medium mb-4 text-foreground">
        <Icon className="size-4 text-primary" />
        {title}
      </h4>
      {children}
    </div>
  )
}
