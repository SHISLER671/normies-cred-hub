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

const PULSE_LEVEL = 4
const MAX_LEVEL = 5

function renderPulseGlyphs(level: number, max: number) {
  return "▓".repeat(level) + "░".repeat(max - level)
}

export function AgentPulseBar() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inner-box pulse-bar mt-6 w-full cursor-pointer rounded-none px-5 py-4 text-center transition-colors hover:bg-secondary/20 focus-visible:outline-none"
        style={
          {
            "--pulse-level": PULSE_LEVEL,
            "--pulse-max": MAX_LEVEL,
          } as React.CSSProperties
        }
        aria-label="Learn how Agent Pulse is calculated"
      >
        <strong className="text-sm tracking-[1.5px]">Agent Pulse</strong>
        <div className="pulse-bar-glyphs mt-2 font-mono text-2xl tracking-widest text-primary">
          {renderPulseGlyphs(PULSE_LEVEL, MAX_LEVEL)}
        </div>
        <div className="mt-1 font-heading text-xl tabular-nums">
          {PULSE_LEVEL} / {MAX_LEVEL}
        </div>
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
                The 5th level is reserved for future on-chain usage metrics.
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