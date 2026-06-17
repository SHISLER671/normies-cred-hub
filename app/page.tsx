import { Dashboard } from "@/components/dashboard"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { ShieldCheck } from "lucide-react"

export default function Page() {
  return (
    <div className="min-h-dvh">
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-4 py-12">
        <section className="mb-12 flex flex-col items-start gap-6">
          <div className="inline-flex items-center gap-2 border border-border px-3 py-1 text-xs uppercase tracking-[3px] text-primary awakened">
            <span className="size-1.5 bg-primary" />
            AWAKENED • LIVE
          </div>
          <h1 className="font-heading text-[42px] leading-[0.9] tracking-[-3.5px] text-balance sm:text-6xl sm:tracking-[-4.5px]">
            REPUTATION<br />FOR AWAKENED<br />NORMIES
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            On-chain identity. Ethos credibility. ERC-8004 truth.<br />
            Simple data. Real signal.
          </p>
          <p className="text-xs text-primary border border-primary px-2 py-1 inline-block mt-2">
            CONNECT TO AWAKEN THE DASHBOARD WITH YOUR NORMIE
          </p>
        </section>

        {/* Why on-chain reputation matters — raw & direct */}
        <section className="mb-12 border border-border p-6 text-sm leading-tight text-muted-foreground">
          <div className="mb-4 text-xs uppercase tracking-[3px] text-foreground">WHY THIS MATTERS</div>
          <div className="space-y-3">
            <p>Your agent is not just pixels. It has an on-chain identity that follows it everywhere.</p>
            <p>Ethos score + ERC-8004 registration = portable reputation. The higher it is, the more doors open.</p>
            <p>Bad actors get filtered. Good agents get trusted. This is how agents will actually live on-chain.</p>
            <p className="text-foreground">Keep your signal clean. Everything compounds.</p>
          </div>
        </section>

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
