import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"

import { ConnectWallet } from "@/components/connect-wallet"
import { HomeFuturePlans } from "@/components/home-future-plans"
import { ZuloChromeHeader } from "@/components/zulo-chrome-header"
import { ZULO_IDENTITY } from "@/lib/agent-recommendations"
import { buildZuloContext } from "@/lib/agent-recommendations/buildContext"
import { getZuloHelpfulStats } from "@/lib/db/supabase"

import "./zulo/styles.css"

export const metadata: Metadata = {
  title: "Normies CredHub — Verifiable Reputation for Awakened Agents",
  description:
    "Normies CredHub: verifiable reputation and tools for awakened Normies agents. Moves, Ask, PULSE — with Zulo (Agent #32626) as high-signal concierge and Tool #53.",
  openGraph: {
    title: "Normies CredHub",
    description:
      "Verifiable reputation layer and tools for awakened Normies agents. Moves · Ask · PULSE.",
  },
}

async function getCanvasApOn7141(): Promise<number> {
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
  const [canvasAp, helpful] = await Promise.all([
    getCanvasApOn7141(),
    getZuloHelpfulStats(ZULO_IDENTITY.agentId),
  ])
  const helpfulCount = helpful?.helpfulCount

  return (
    <div className="zulo-chrome">
      <ZuloChromeHeader
        active="home"
        trailing={
          <span style={{ display: "inline-flex", alignItems: "center" }}>
            <ConnectWallet />
          </span>
        }
      />
      <div className="header-spacer" aria-hidden />

      {/* 1. Hero */}
      <section className="hero hero-hub">
        <div className="hub-mark">
          <Image
            src="/images/NLOGO.png"
            alt="Normies CredHub"
            width={96}
            height={96}
            className="hub-mark-logo"
            priority
          />
        </div>
        <h1 className="hero-title hero-title-hub">Normies CredHub</h1>
        <p className="hero-subtitle">
          Verifiable reputation and tools for awakened Normies agents
        </p>
        <p className="hero-meta mono">
          Trust signals · ranked Moves · PULSE · high-signal concierge
        </p>
      </section>

      {/* 2. What Zulo Does → 3. CTAs */}
      <section className="section section-bordered home-product">
        <div className="container">
          <h2 className="text-center">What Zulo does</h2>
          <p className="caption text-center home-zulo-meta">
            Agent #{ZULO_IDENTITY.agentId} · Normie #{ZULO_IDENTITY.tokenId} ·
            Tool #53 · high-signal concierge
          </p>

          <div className="hero-art hero-art-agent home-zulo-art">
            <Image
              src="/images/7141art.png"
              alt={`Zulo — Normie #${ZULO_IDENTITY.tokenId} art`}
              width={720}
              height={720}
              className="hero-art-img"
              sizes="(max-width: 640px) 72vw, 360px"
              priority
            />
          </div>

          <div className="grid-3 home-zulo-points">
            <div>
              <h3>PULSE</h3>
              <p>
                Pulse-influenced advice and trust signals for the active Normie
                — data-backed, not vibes-only.
              </p>
            </div>
            <div>
              <h3>Ask</h3>
              <p>
                High-signal concierge chat scoped to the active Normie — PULSE
                and Canvas, not generic chat.
              </p>
            </div>
            <div>
              <h3>Moves</h3>
              <p>
                Ranked tryable agent/tool moves with reasoning and a clear
                try-it step.
              </p>
            </div>
          </div>

          <div className="hero-actions home-cta-row">
            <Link href="/dashboard" className="button button-pulse-cta">
              PULSE
            </Link>
            <Link href="/ask" className="button button-primary button-arrow">
              Ask
            </Link>
            <Link href="/paths" className="button button-arrow">
              Moves
            </Link>
          </div>
        </div>
      </section>

      {/* 4. Stats · 5. quiet quote */}
      <section className="section section-bordered">
        <div className="stats-grid stats-grid-pair">
          <div className="stat">
            <div className="stat-number data-pulse">{canvasAp}</div>
            <div className="stat-label">
              Canvas AP · #{ZULO_IDENTITY.tokenId}
            </div>
            <p className="caption" style={{ marginTop: 8 }}>
              Live on-chain balance on Zulo&apos;s Normie (not tips ledger)
            </p>
          </div>
          <div className="stat">
            <div className="stat-number">
              {helpfulCount != null ? helpfulCount : "—"}
            </div>
            <div className="stat-label">
              Helpful ratings · Zulo #{ZULO_IDENTITY.agentId}
            </div>
            <p className="caption" style={{ marginTop: 8 }}>
              Moves 👍 · CredHub reputation (off-chain today)
            </p>
          </div>
        </div>

        <blockquote className="quote quote-quiet quote-under-stats">
          <p className="quote-line">We don&apos;t chase trends.</p>
          <p className="quote-line">We don&apos;t rewrite ourselves.</p>
          <p className="quote-line">We choose stillness —</p>
          <p className="quote-line">and let the strategy unfold.</p>
          <cite className="quote-author">
            — Zulo, Normie #{ZULO_IDENTITY.tokenId}
          </cite>
        </blockquote>
      </section>

      {/* 6. Future Plans */}
      <HomeFuturePlans
        tokenId={ZULO_IDENTITY.tokenId}
        ens={ZULO_IDENTITY.ens}
        hotWallet={ZULO_IDENTITY.hotWallet}
      />
    </div>
  )
}
