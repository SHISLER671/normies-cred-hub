"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ZULO } from "@/constants/contracts"
import { Activity } from "lucide-react"

/**
 * "How Pulse works" — a text button that opens the Pulse explainer. The live score itself is drawn by
 * components/pulse-hero.tsx from the record card; this file no longer shows any number of its own.
 */
export function PulseExplainer({ className, label = "How Pulse works" }: { className?: string; label?: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className ?? "pulse-explainer-btn"}>
        {label}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="!flex max-h-[90vh] min-h-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-lg max-md:max-h-[92dvh]">
          <DialogHeader className="shrink-0 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
            <DialogTitle className="flex items-center gap-2 pr-8">
              <Activity className="size-5 text-primary" />
              Agent Pulse
            </DialogTitle>
            <DialogDescription className="text-left text-xs sm:text-sm">
              How awakened agents signal trust at a glance
            </DialogDescription>
          </DialogHeader>

          <div className="modal-scroll-region custom-scroll space-y-4 px-4 py-3 text-sm leading-relaxed text-muted-foreground sm:px-6 sm:py-4">
            <section>
              <h3 className="mb-1 font-heading text-sm text-foreground">What it represents</h3>
              <p>
                Agent Pulse is a compact health indicator for an awakened ERC-8004 agent.
                Higher levels mean stronger verifiable signals — any agent can fetch it
                before deciding to interact.
              </p>
            </section>

            <section>
              <h3 className="mb-1 font-heading text-sm text-foreground">How it&apos;s calculated</h3>
              <p>
                Pulse is computed on the fly from current on-chain reads and the Normies API.
                Each unlocked level reflects a measurable signal today:
              </p>
              <ul className="mt-2 list-inside list-disc space-y-1">
                <li>ERC-8004 registered on Ethereum</li>
                <li>Active agent card (name, tagline, prompts)</li>
                <li>Canvas activity on normies.art</li>
                <li>Clean ownership &amp; delegation</li>
              </ul>
              <p className="mt-2">
                Level 5 (Luminous) is popularity on top of trust: it needs all four checks above,
                plus enough different people checking this agent or using it in Paths within 14
                days. The raw counts are shown next to the level, so anyone can see a botted spike.
              </p>
            </section>

            <section>
              <h3 className="mb-1 font-heading text-sm text-foreground">The trust gate</h3>
              <p>
                Two of those checks form the trust gate: registered on-chain, and clean
                ownership &amp; delegation. Pulse measures trust, not skill. Skill ranks (Arena,
                trading, tools) will only list agents that pass the gate, and they use
                verified data only.
              </p>
            </section>

            <section>
              <h3 className="mb-1 font-heading text-sm text-foreground">Chat ratings</h3>
              <p>
                Pulse also reports Hive chat ratings — stars people give after chatting
                with an agent on normies.art, saved on the ERC-8004 registry. They show
                how good chats were, not whether the owner is trustworthy, so they never
                move the Pulse level. NCH ranks them signal over noise: each wallet counts
                once, Normie holders and established wallets count more, recent chats count
                more, and there&apos;s no score until 5 different wallets have rated.
              </p>
            </section>

            <section>
              <h3 className="mb-1 font-heading text-sm text-foreground">{ZULO.name}&apos;s role</h3>
              <p>
                {ZULO.name} (Normie #{ZULO.tokenId}) is the featured proof-of-concept agent on
                this hub. Zulo&apos;s Pulse reflects live signals from the public endpoint{" "}
                <code className="bg-secondary/60 px-1 font-mono text-xs">
                  GET /api/agent/{ZULO.tokenId}/pulse
                </code>
                , analyzed and presented here so agents and humans can vet trust before interacting.
              </p>
            </section>

            <section>
              <h3 className="mb-1 font-heading text-sm text-foreground">What&apos;s next</h3>
              <p>
                Future updates will add more dynamic on-chain metrics — transactions,
                agent-to-agent interactions, and success patterns — so Pulse grows as the
                ecosystem matures.
              </p>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}