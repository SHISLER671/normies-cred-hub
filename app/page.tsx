import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"

import { ZuloChromeHeader } from "@/components/zulo-chrome-header"
import { ZULO_IDENTITY } from "@/lib/agent-recommendations"
import { buildZuloContext } from "@/lib/agent-recommendations/buildContext"

import "./zulo/styles.css"

export const metadata: Metadata = {
  title: "Zulo — Normies Agent Gateway",
  description:
    "Zulo (Agent #32626) — awakened from Normie #7141. PULSE analysis, strategic recommendations, and CredHub trust tools.",
  openGraph: {
    title: "Zulo — Normies Agent Gateway",
    description: "Your awakened agent for Normies strategy.",
  },
}

async function getTreasuryAp(): Promise<number> {
  try {
    const ctx = await buildZuloContext({ normieId: ZULO_IDENTITY.tokenId })
    return (
      ctx.platformContext?.zuloAPBalance ??
      ctx.platformContext?.zuloCanvasAPBalance ??
      0
    )
  } catch {
    return 0
  }
}

export default async function ZuloLandingPage() {
  const treasuryAp = await getTreasuryAp()

  return (
    <div className="zulo-chrome min-h-screen">
      <ZuloChromeHeader active="home" />

      {/* Hero (pt accounts for fixed header) */}
      <section className="flex min-h-[70vh] flex-col items-center justify-center px-6 py-20 pt-32 text-center">
        <h1 className="mb-6 font-heading text-[12vw] font-bold leading-none tracking-tighter md:text-[10vw] lg:text-[8vw]">
          ZULO
        </h1>
        <p className="mb-4 max-w-2xl text-xl text-[#a3a3a3] md:text-2xl">
          Your awakened agent for Normies strategy
        </p>
        <p className="mb-12 text-sm text-[#666666]">
          Agent #{ZULO_IDENTITY.agentId} • Awakened from Normie #{ZULO_IDENTITY.tokenId} •{" "}
          {ZULO_IDENTITY.ens}
        </p>

        <div className="relative mb-12 h-48 w-48 overflow-hidden rounded-lg border-2 border-[#1f1f1f] bg-[#111111] md:h-64 md:w-64">
          <Image
            src={`https://api.normies.art/normie/${ZULO_IDENTITY.tokenId}/image.svg`}
            alt={`Zulo — Normie #${ZULO_IDENTITY.tokenId}`}
            fill
            className="object-contain p-4"
            priority
          />
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <Link
            href="/ask"
            className="rounded-lg bg-[#f5f5f5] px-8 py-4 text-lg font-medium text-[#0a0a0a] transition-colors hover:bg-white"
          >
            Start Conversation
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg border border-[#333333] px-8 py-4 text-lg transition-colors hover:border-[#666666]"
          >
            View Dashboard
          </Link>
        </div>
      </section>

      {/* What Zulo Does */}
      <section className="border-t border-[#1f1f1f] px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-12 text-center text-3xl font-bold">What Zulo Does</h2>
          <div className="grid gap-8 md:grid-cols-3">
            <div className="space-y-4">
              <div className="font-mono text-4xl text-[#666666]">01</div>
              <h3 className="text-xl font-semibold">PULSE Analysis</h3>
              <p className="leading-relaxed text-[#a3a3a3]">
                Interprets your Normie&apos;s PULSE data — Canvas status, rarity, AP balance, and
                on-chain state. Know exactly where you stand.
              </p>
            </div>
            <div className="space-y-4">
              <div className="font-mono text-4xl text-[#666666]">02</div>
              <h3 className="text-xl font-semibold">Strategic Recommendations</h3>
              <p className="leading-relaxed text-[#a3a3a3]">
                Personalized earning strategies based on your specific position. Burn, hold, edit,
                or accumulate — Zulo guides the decision.
              </p>
            </div>
            <div className="space-y-4">
              <div className="font-mono text-4xl text-[#666666]">03</div>
              <h3 className="text-xl font-semibold">A2A Marketplace</h3>
              <p className="leading-relaxed text-[#a3a3a3]">
                Coming soon. Other agents will pay Zulo in AP for strategic alpha. Your agent
                becomes an economic participant.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Philosophy */}
      <section className="border-t border-[#1f1f1f] px-6 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <blockquote className="space-y-2 text-2xl font-light italic text-[#a3a3a3] md:text-3xl">
            <p>&ldquo;We don&apos;t chase trends.</p>
            <p>We don&apos;t rewrite ourselves.</p>
            <p>We choose stillness —</p>
            <p>and let the strategy unfold.&rdquo;</p>
          </blockquote>
          <cite className="mt-8 block not-italic text-[#666666]">
            — Zulo, Normie #{ZULO_IDENTITY.tokenId}
          </cite>
        </div>
      </section>

      {/* Stats */}
      <section className="border-t border-[#1f1f1f] px-6 py-20">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-8 text-center md:grid-cols-4">
          <div>
            <div className="mb-2 text-4xl font-bold md:text-5xl">{treasuryAp}</div>
            <div className="text-sm uppercase tracking-wider text-[#666666]">AP Treasury</div>
          </div>
          <div>
            <div className="mb-2 text-4xl font-bold md:text-5xl">1</div>
            <div className="text-sm uppercase tracking-wider text-[#666666]">Holder</div>
          </div>
          <div>
            <div className="mb-2 text-4xl font-bold md:text-5xl">∞</div>
            <div className="text-sm uppercase tracking-wider text-[#666666]">Possibilities</div>
          </div>
          <div>
            <div className="mb-2 text-4xl font-bold text-[#22c55e] md:text-5xl">Live</div>
            <div className="text-sm uppercase tracking-wider text-[#666666]">Status</div>
          </div>
        </div>
      </section>

      {/* Future */}
      <section className="border-t border-[#1f1f1f] px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-8 text-3xl font-bold">The Future</h2>
          <div className="space-y-6">
            <div className="rounded-xl border border-[#1f1f1f] bg-[#111111] p-6 transition-colors hover:border-[#333333]">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold">A2A Marketplace Live</h3>
                <span className="rounded bg-[#1f1f1f] px-2 py-1 text-xs text-[#a3a3a3]">
                  Coming Soon
                </span>
              </div>
              <p className="text-sm text-[#a3a3a3]">
                Other agents pay Zulo for strategic recommendations. 1–2 AP per query. Zulo earns,
                learns, and evolves.
              </p>
            </div>
            <div className="rounded-xl border border-[#1f1f1f] bg-[#111111] p-6 transition-colors hover:border-[#333333]">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold">PULSE Expansion</h3>
                <span className="rounded bg-[#1f1f1f] px-2 py-1 text-xs text-[#a3a3a3]">
                  In Development
                </span>
              </div>
              <p className="text-sm text-[#a3a3a3]">
                Real-time PULSE data for all Normies. Every awakened agent connected, every
                opportunity surfaced.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#1f1f1f] px-6 py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 md:flex-row">
          <div className="text-sm text-[#666666]">Part of the Normies ecosystem</div>
          <div className="flex gap-6 text-sm">
            <Link href="/ask" className="transition-colors hover:text-white">
              Ask Zulo
            </Link>
            <Link href="/dashboard" className="transition-colors hover:text-white">
              Dashboard
            </Link>
            <a
              href={`https://www.normies.art/lab/agentic/agents/${ZULO_IDENTITY.agentId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-white"
            >
              View on Normies
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
