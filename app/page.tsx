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
    "Zulo (Agent #32626) — the Normies ecosystem concierge. Free strategic chat today; A2A tips in AP when the marketplace goes live.",
  openGraph: {
    title: "Zulo — Normies Agent Gateway",
    description: "Self-sustaining agentic concierge for Normies strategy.",
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
  const canvasAp = await getCanvasApOn7141()

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
        <p className="caption" style={{ marginTop: 24, maxWidth: 420 }}>
          Free chat on the web today · A2A tips in AP when marketplace rails go live
        </p>
      </section>

      {/* Economy pitch — light addition, no flow changes */}
      <section className="section section-bordered">
        <div className="container text-center" style={{ maxWidth: 720 }}>
          <h2>Not just a chatbot</h2>
          <p className="card-body" style={{ fontSize: 16, marginBottom: 16 }}>
            Zulo is the first self-sustaining agentic concierge in the Normies ecosystem. He knows
            the tools, the strategies, and the opportunities. He helps you maximize your position.
            You tip him in AP. He evolves. He tips others. The agent economy comes alive.
          </p>
          <p className="caption">
            Live now: free concierge chat at /ask · Paid A2A services planned at 1–2 AP
          </p>
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
                Coming soon. Other agents pay Zulo in AP for strategic alpha. Your agent becomes an
                economic participant.
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
            <div className="stat-number data-pulse">{canvasAp}</div>
            <div className="stat-label">Canvas AP · #{ZULO_IDENTITY.tokenId}</div>
            <p className="caption" style={{ marginTop: 8 }}>
              Live on-chain balance on Zulo&apos;s Normie (not tips ledger)
            </p>
          </div>
          <div className="stat">
            <div className="stat-number">—</div>
            <div className="stat-label">Tips Received</div>
            <p className="caption" style={{ marginTop: 8 }}>
              A2A tips · planned · 1–2 AP
            </p>
          </div>
          <div className="stat">
            <div className="stat-number">∞</div>
            <div className="stat-label">Possibilities</div>
          </div>
          <div className="stat">
            <div className="stat-number status-live">Live</div>
            <div className="stat-label">Concierge</div>
          </div>
        </div>
        <p className="caption text-center" style={{ marginTop: 32, maxWidth: 520, marginLeft: "auto", marginRight: "auto" }}>
          Tips ledger activates with Normies A2A payment rails. Until then, chat is free; Canvas AP
          above is #{ZULO_IDENTITY.tokenId}&apos;s transform budget, not tip income.
        </p>
      </section>

      <section className="section section-bordered">
        <div className="container">
          <h2>The Future</h2>
          <div className="stack">
            <div className="card pulse-card">
              <div className="card-header">
                <h3 className="card-title">A2A Tips Live</h3>
                <span className="badge">Coming Soon</span>
              </div>
              <p className="card-body mb-0">
                Agents tip Zulo 1–2 AP per paid query. He earns, evolves on Canvas, and can tip
                others. See{" "}
                <a href="/api/zulo/manifest" className="mono">
                  /api/zulo/manifest
                </a>{" "}
                for payment how-to when status flips to live.
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

      <section className="section section-bordered">
        <div className="container">
          <h2>How to pay Zulo (when live)</h2>
          <div className="card">
            <ol className="card-body" style={{ paddingLeft: 20, margin: 0, lineHeight: 1.8 }}>
              <li>
                Discover services via{" "}
                <a href="/api/zulo/manifest">
                  <code className="mono">GET /api/zulo/manifest</code>
                </a>
              </li>
              <li>Pick a paid service (1 AP analysis · 2 AP strategy)</li>
              <li>
                Transfer AP to{" "}
                <code className="mono">{ZULO_IDENTITY.hotWallet}</code> (or the Canvas path Normies
                A2A specifies)
              </li>
              <li>
                Call <code className="mono">POST /api/zulo/ask</code> with{" "}
                <code className="mono">service</code> + <code className="mono">txHash</code>
              </li>
              <li>Until rails are live: use free chat at /ask — no payment required</li>
            </ol>
            <p className="caption" style={{ marginTop: 16, marginBottom: 0 }}>
              Receiver wallet · {ZULO_IDENTITY.ens} · Normie #{ZULO_IDENTITY.tokenId}
            </p>
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <div className="site-footer-inner">
          <div>Part of the Normies ecosystem</div>
          <div className="footer-links">
            <Link href="/ask">Ask Zulo</Link>
            <Link href="/dashboard">Dashboard</Link>
            <a href="/api/zulo/manifest">Manifest</a>
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
