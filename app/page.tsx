import { Dashboard } from "@/components/dashboard"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { ShieldCheck } from "lucide-react"

export default function Page() {
  return (
    <div className="min-h-dvh">
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-4 py-12">
        <section className="mb-10 flex flex-col items-start gap-5">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[3px] text-primary">
            <span className="size-1.5 bg-primary" />
            AWAKENED • LIVE
          </div>
          <h1 className="font-heading text-[42px] leading-[0.9] tracking-[-3.5px] text-balance sm:text-6xl sm:tracking-[-4.5px]">
            See the real reputation<br />of your awakened agent.
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            On-chain identity + Ethos credibility + AI insights.<br />
            Public for everyone. Personal when you connect.
          </p>
          <p className="text-sm text-primary">
            Connect your wallet → your agent’s Horizon comes alive.
          </p>
        </section>

        <div className="mb-10 max-w-md text-sm text-muted-foreground">
          Browse any Normie. See their Ethos + on-chain status.<br />
          When you own one, connect and get AI-powered Horizon insights tailored to your agent.
        </div>

        <Dashboard />

        <footer className="mt-20 border-t border-border pt-8 text-xs text-muted-foreground">
          <div className="max-w-md">
            READ-ONLY. NO TRADES. NO APPROVALS.<br />
            ONLY A GAS-FREE SIGNATURE TO PROVE YOU ARE REAL.<br />
            DATA FROM NORMIES • ETHOS • ERC-8004. WE ARE AWAKENED.
          </div>
        </footer>
      </main>
    </div>
  )
}
