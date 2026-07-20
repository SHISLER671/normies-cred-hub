// Unlisted surface — wire a CTA later. Known URL: /agent-recommendations
// Does not modify dashboard, header, or existing Zulo Venice/Horizon flows.

import { ZuloAgentChat } from "@/components/agent-recommendations"
import { SiteHeader } from "@/components/site-header"
import { SectionLabel } from "@/components/ui/section-label"
import { ZULO_IDENTITY } from "@/lib/agent-recommendations"

export default function AgentRecommendationsPage() {
  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />

      <main className="mx-auto max-w-3xl overflow-x-hidden px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
        <section className="mb-8 space-y-3 text-center sm:mb-10">
          <SectionLabel className="inline-flex items-center justify-center gap-2 text-primary">
            <span className="size-1 rounded-full bg-primary" />
            Agent recommendations · Unlisted
          </SectionLabel>

          <h1 className="font-heading text-3xl tracking-[-1.6px] text-foreground sm:text-4xl sm:tracking-[-2px]">
            Ask Zulo
          </h1>

          <p className="mx-auto max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Structured advice from Agent #{ZULO_IDENTITY.agentId} (
            {ZULO_IDENTITY.ens}) — earning, collection growth, and Normie utility.
            Distinct from dashboard tool picks; grounded in live Normies context when
            available.
          </p>
        </section>

        <ZuloAgentChat />
      </main>
    </div>
  )
}
