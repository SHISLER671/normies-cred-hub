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

          <p className="mt-6 max-w-xl text-xl text-muted-foreground font-body">
            On-chain identity meets portable reputation.<br />
            Public for everyone. Personal when you connect.
          </p>

          <p className="mt-4 text-sm text-primary/90">
            Connect your wallet → your agent’s Horizon comes alive.
          </p>
        </section>

        {/* Agent Queryable — public endpoint for awakened agents */}
        <section className="mx-auto mb-12 max-w-3xl rounded-none border border-primary/40 bg-card/70 p-6 sm:p-8 text-center animate-slide-up">
          <SectionLabel className="text-primary mb-2 tracking-[2px]">FEATURED</SectionLabel>
          <h2 className="font-heading text-3xl tracking-[-2px] sm:text-4xl">Agent Queryable</h2>
          <p className="mt-3 text-muted-foreground">Other awakened agents can read this data directly.</p>

          <div className="mt-6 rounded-none border border-border bg-background/60 px-5 py-4">
            <strong className="text-sm tracking-[1.5px]">Agent Pulse</strong>
            <div className="mt-2 font-mono text-2xl tracking-widest">▓▓▓▓░</div>
            <div className="mt-1 font-heading text-xl tabular-nums">4 / 5</div>
          </div>

          <p className="mt-5 text-sm text-muted-foreground">
            Real data pulled live from the Normies API + on-chain records.
          </p>

          <div className="mt-6 rounded-none border border-border bg-background/60 px-5 py-4 text-left">
            <strong className="text-sm tracking-[1.5px]">Public Endpoint</strong>
            <span className="text-muted-foreground text-sm"> (any agent can call this):</span>
            <pre className="mt-2 overflow-x-auto rounded-none border border-border bg-secondary/40 px-3 py-2 font-mono text-sm">
              GET /api/agent/{ZULO.tokenId}/pulse
            </pre>
          </div>

          <div className="mt-4 rounded-none border border-border bg-background/60 px-5 py-4 text-left">
            <strong className="text-sm tracking-[1.5px]">Example Response:</strong>
            <pre className="mt-2 overflow-x-auto rounded-none border border-border bg-secondary/40 px-3 py-2 font-mono text-xs leading-relaxed sm:text-sm">
{`{
  "token_id": ${ZULO.tokenId},
  "agent_id": ${ZULO.agentId},
  "pulse_level": 4,
  "max_level": 4,
  "status": "Strong",
  "breakdown": [
    "ERC-8004 registered",
    "Has active agent card",
    "Canvas activity detected",
    "Clean ownership & delegation"
  ],
  "note": "This Pulse uses currently available signals from the Normies API. As more agents transact and interact on-chain, real usage metrics will be added in future updates."
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
