import { Dashboard } from "@/components/dashboard"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { ShieldCheck } from "lucide-react"

export default function Page() {
  return (
    <div className="min-h-dvh">
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-4 py-10">
        <section className="mb-10 flex flex-col items-start gap-4">
          <Badge variant="outline" className="gap-1.5 border-primary/30 text-primary">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden />
            Live data · Normies + Ethos + ERC-8004
          </Badge>
          <h1 className="font-heading text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            Reputation for awakened Normie agents
          </h1>
          <p className="max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
            NormiesCredHub unifies an agent&apos;s on-chain identity, its owner&apos;s Ethos
            credibility, and its ERC-8004 registration into a single trust dashboard. Explore the
            featured agent below or look up any Normie by token ID.
          </p>
        </section>

        <Dashboard />

        <footer className="mt-16 flex flex-col gap-3 border-t border-border pt-8 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
            <p className="text-pretty">
              <span className="font-medium text-foreground">Safety first.</span> NormiesCredHub is
              read-only. It never requests transactions, transfers, or token approvals. The only
              wallet action offered is a gas-free message signature used purely to prove identity
              linkage.
            </p>
          </div>
          <p className="text-xs">
            Data sourced live from the public Normies API, the Ethos Network API, and the ERC-8004
            Identity Registry on Ethereum. Reputation scores are informational and not financial
            advice.
          </p>
        </footer>
      </main>
    </div>
  )
}
