import { Dashboard } from "@/components/dashboard"
import { SiteHeader } from "@/components/site-header"
import { SectionLabel } from "@/components/ui/section-label"
import { ShieldCheck } from "lucide-react"

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

        {/* Subtle context line */}
        <div className="mx-auto max-w-lg text-center mb-14 text-sm text-muted-foreground font-body">
          Browse any Normie. See Ethos, on-chain status, and AI-powered tool recommendations.
        </div>

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
