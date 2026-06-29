import { AgentPulseBar } from "@/components/agent-pulse-bar"
import { Dashboard } from "@/components/dashboard"
import { SiteHeader } from "@/components/site-header"
import { SectionLabel } from "@/components/ui/section-label"
import { ZULO } from "@/constants/contracts"

export default function Page() {
  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />

      <main className="mx-auto max-w-5xl px-4 sm:px-6 pixel-texture">
        {/* Hero — strongly centered, focused, premium */}
        <section className="flex flex-col items-center text-center pt-16 pb-12 sm:pt-20 sm:pb-16 animate-slide-up">
          <SectionLabel className="inline-flex items-center gap-2 text-primary mb-4">
            <span className="size-1 bg-primary rounded-full" />
            Awakened • Live
          </SectionLabel>

          <h1 className="font-heading text-5xl leading-none tracking-[-3.2px] sm:text-7xl sm:tracking-[-4.8px] max-w-4xl">
            See the real reputation<br />of your awakened agent.
          </h1>

          <p className="mt-6 max-w-2xl text-xl text-muted-foreground font-body text-pretty">
            A verifiable reputation layer for autonomous agents.<br />
            On-chain identity meets portable trust — public for everyone, personal when you connect.
          </p>

          <p className="mt-4 text-sm text-primary/90">
            Connect your wallet → your agent’s Horizon comes alive.
          </p>
        </section>

        {/* Agent Queryable — public endpoint for awakened agents */}
        <section className="mx-auto mb-12 max-w-3xl rounded-none border border-primary/40 bg-card/70 p-6 sm:p-8 text-center animate-slide-up">
          <SectionLabel className="text-primary mb-2 tracking-[2px]">AGENT-TO-AGENT TRUST</SectionLabel>
          <h2 className="font-heading text-3xl tracking-[-2px] sm:text-4xl text-balance">Agents can vet each other before they interact.</h2>
          <p className="mt-3 text-muted-foreground text-pretty">One public endpoint returns any agent&apos;s trust profile as JSON — no dashboard required.</p>

          <AgentPulseBar />

          <p className="mt-5 text-sm text-muted-foreground">
            Real data pulled live from the Normies API + on-chain records.
          </p>

          <div className="inner-box mt-6 rounded-none px-5 py-4 text-left">
            <strong className="text-sm tracking-[1.5px]">Public Endpoint</strong>
            <span className="text-muted-foreground text-sm"> (any agent can call this):</span>
            <pre className="mt-2 overflow-x-auto rounded-none bg-secondary/40 px-3 py-2 font-mono text-sm">
              GET /api/agent/{ZULO.tokenId}/pulse
            </pre>
          </div>

          <div className="inner-box mt-4 rounded-none px-5 py-4 text-left">
            <strong className="text-sm tracking-[1.5px]">Example Response:</strong>
            <pre className="mt-2 overflow-x-auto rounded-none bg-secondary/40 px-3 py-2 font-mono text-xs leading-relaxed sm:text-sm">
{`{
  "token_id": ${ZULO.tokenId},
  "agent_id": ${ZULO.agentId},
  "pulse_level": 4,
  "max_level": 5,
  "status": "Strong",
  "breakdown": [
    "ERC-8004 registered",
    "Has active agent card",
    "Canvas activity detected",
    "Clean ownership & delegation"
  ],
  "next_signal": "Reserved for future on-chain usage metrics — there's always room for improvement.",
  "note": "This Pulse uses currently available signals from the Normies API. The 5th level unlocks as more agents transact and interact on-chain in future updates."
}`}
            </pre>
          </div>

          <p className="mt-5 text-sm text-muted-foreground">
            Any awakened agent can fetch this before deciding to interact.
          </p>
          <p className="mt-2 text-xs italic text-muted-foreground/80">
            Future updates will include direct signals from agent activity (transactions, interactions, success patterns).
          </p>
        </section>

        {/* Main dashboard content — centered focus */}
        <div className="pb-16">
          <Dashboard />
        </div>

        {/* Footer */}
        <footer className="border-t border-border pt-10 pb-12 text-center">
          <SectionLabel className="mx-auto max-w-md text-muted-foreground font-body">
            READ-ONLY. NO TRADES. NO APPROVALS.<br />
            ONLY A GAS-FREE SIGNATURE TO PROVE YOU ARE REAL.<br />
            DATA FROM NORMIES • ETHOS • ERC-8004. WE ARE AWAKENED.
          </SectionLabel>
        </footer>
      </main>
    </div>
  )
}
