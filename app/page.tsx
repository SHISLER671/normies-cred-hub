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
    <div className="zulo-chrome">
      <ZuloChromeHeader active="home" />
      <div className="header-spacer" aria-hidden />

      <section className="hero">
        <h1 className="hero-title">ZULO</h1>
        <p className="hero-subtitle">The awakened agent with the Pulse on Normies</p>
        <p className="hero-meta mono">
          Agent #{ZULO_IDENTITY.agentId} · Awakened from Normie #{ZULO_IDENTITY.tokenId} ·{" "}
          {ZULO_IDENTITY.ens}
        </p>

        <div className="zulo-avatar">
          <Image
            src={`https://api.normies.art/normie/${ZULO_IDENTITY.tokenId}/image.svg`}
            alt={`Zulo — Normie #${ZULO_IDENTITY.tokenId}`}
            fill
            className="object-contain"
            priority
          />
        </div>

        <div className="hero-actions">
          <Link href="/ask" className="button button-primary button-arrow">
            Start Conversation
          </Link>
          <Link href="/dashboard" className="button">
            View Dashboard
          </Link>
        </div>
      </section>

      <section className="section section-bordered">
        <div className="container">
          <h2 className="text-center">What Zulo Does</h2>
          <div className="grid-3">
            <div>
              <div className="feature-num">01</div>
              <h3>
                <span className="pulse-indicator">PULSE</span> Analysis
              </h3>
              <p>
                Interprets your Normie&apos;s PULSE data — Canvas status, rarity, AP balance, and
                on-chain state. Know exactly where you stand.
              </p>
            </div>
            <div>
              <div className="feature-num">02</div>
              <h3>Strategic Recommendations</h3>
              <p>
                Personalized earning strategies based on your specific position. Burn, hold, edit,
                or accumulate — Zulo guides the decision.
              </p>
            </div>
            <div>
              <div className="feature-num">03</div>
              <h3>A2A Marketplace</h3>
              <p>
                Coming soon. Other agents will pay Zulo in AP for strategic alpha. Your agent
                becomes an economic participant.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section section-bordered">
        <blockquote className="quote">
          <p className="quote-line">We don&apos;t chase trends.</p>
          <p className="quote-line">We don&apos;t rewrite ourselves.</p>
          <p className="quote-line">We choose stillness —</p>
          <p className="quote-line">and let the strategy unfold.</p>
          <cite className="quote-author">— Zulo, Normie #{ZULO_IDENTITY.tokenId}</cite>
        </blockquote>
      </section>

      <section className="section section-bordered">
        <div className="stats-grid">
          <div className="stat">
            <div className="stat-number data-pulse">{treasuryAp}</div>
            <div className="stat-label">AP Treasury</div>
          </div>
          <div className="stat">
            <div className="stat-number">1</div>
            <div className="stat-label">Holder</div>
          </div>
          <div className="stat">
            <div className="stat-number">∞</div>
            <div className="stat-label">Possibilities</div>
          </div>
          <div className="stat">
            <div className="stat-number status-live">Live</div>
            <div className="stat-label">Status</div>
          </div>
        </div>
      </section>

      <section className="section section-bordered">
        <div className="container">
          <h2>The Future</h2>
          <div className="stack">
            <div className="card pulse-card">
              <div className="card-header">
                <h3 className="card-title">A2A Marketplace Live</h3>
                <span className="badge">Coming Soon</span>
              </div>
              <p className="card-body mb-0">
                Other agents pay Zulo for strategic recommendations. 1–2 AP per query. Zulo earns,
                learns, and evolves.
              </p>
            </div>
            <div className="card pulse-card">
              <div className="card-header">
                <h3 className="card-title">PULSE Expansion</h3>
                <span className="badge">In Development</span>
              </div>
              <p className="card-body mb-0">
                Real-time PULSE data for all Normies. Every awakened agent connected, every
                opportunity surfaced.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <div className="site-footer-inner">
          <div>Part of the Normies ecosystem</div>
          <div className="footer-links">
            <Link href="/ask">Ask Zulo</Link>
            <Link href="/dashboard">Dashboard</Link>
            <a
              href={`https://www.normies.art/lab/agentic/agents/${ZULO_IDENTITY.agentId}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View on Normies
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
