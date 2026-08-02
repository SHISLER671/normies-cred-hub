import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"

import { ConnectWallet } from "@/components/connect-wallet"
import { ZuloChromeHeader } from "@/components/zulo-chrome-header"
import { ZULO_IDENTITY } from "@/lib/agent-recommendations"
import { buildZuloContext } from "@/lib/agent-recommendations/buildContext"
import { getZuloHelpfulStats } from "@/lib/db/supabase"
import { isPathBoardEnabled } from "@/lib/features"

import "./zulo/styles.css"

export const metadata: Metadata = {
  title: "Zulo — High-Signal Normies Concierge",
  description:
    "Zulo (Agent #32626) — high-signal Normies concierge for smarter burns, trait/tool choices, and Canvas moves. Free Moves · CredHub Pulse.",
  openGraph: {
    title: "Zulo — High-Signal Normies Concierge",
    description:
      "Better burns, tools, and Canvas moves — ranked Moves you can try and rate. Agent #32626.",
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
  const pathBoard = isPathBoardEnabled()
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

      <section className="hero">
        <h1 className="hero-title">ZULO</h1>
        <p className="hero-subtitle">
          High-signal Normies concierge
        </p>
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
          <Link
            href="/paths"
            className={
              pathBoard
                ? "button button-primary button-arrow"
                : "button button-arrow"
            }
          >
            Moves
          </Link>
          <Link
            href="/ask"
            className={
              pathBoard ? "button" : "button button-primary button-arrow"
            }
          >
            Ask
          </Link>
          <Link href="/dashboard" className="button">
            Dashboard
          </Link>
        </div>
        <p className="caption" style={{ marginTop: 24, maxWidth: 440 }}>
          Burns · tools · Canvas · free Moves · rate 👍/👎 · CredHub trust
        </p>
      </section>

      <section className="section section-bordered">
        <div className="container">
          <h2 className="text-center">What Zulo Does</h2>
          <p
            className="card-body text-center"
            style={{
              fontSize: 16,
              marginBottom: 12,
              maxWidth: 640,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            Zulo helps holders and awakened NFT agents make more informed choices
            for burns, trait/tool choices, and Canvas edits.
          </p>
          <p
            className="caption text-center"
            style={{ marginBottom: 32 }}
          >
            · NormiesCredHub PULSE Tool #53
          </p>
          <div className="grid-3">
            <div>
              <div className="feature-num">01</div>
              <h3>Pulse-influenced advice</h3>
              <p>
                Interprets your awakened Normie&apos;s PULSE so recommendations
                stay data-backed, not vibes-only.
              </p>
            </div>
            <div>
              <div className="feature-num">02</div>
              <h3>Ranked moves you can try</h3>
              <p>
                Intent → 3 to 5 agent/tool MOVES including reasoning and a try-it
                step.
              </p>
            </div>
            <div>
              <div className="feature-num">03</div>
              <h3>Rate · dual credit</h3>
              <p>
                👍/👎 on MOVES. Helpful ratings credit the recommended agent/tool
                and Zulo.
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
          <div className="stat">
            <div className="stat-number">∞</div>
            <div className="stat-label">Possibilities</div>
          </div>
          <div className="stat">
            <div className="stat-number status-live">Live</div>
            <div className="stat-label">Concierge</div>
          </div>
        </div>
        <p
          className="caption text-center"
          style={{
            marginTop: 32,
            maxWidth: 560,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          Ratings build Zulo&apos;s trackable reputation in CredHub today. On-chain
          tips and TBA rails activate when serc enables x402 + ERC-6551 for #
          {ZULO_IDENTITY.tokenId}. Moves stays free. Canvas AP above is #
          {ZULO_IDENTITY.tokenId}&apos;s transform budget, not tip income.
        </p>
      </section>

      <section className="section section-bordered">
        <div className="container">
          <h2>The Future</h2>
          <div className="stack">
            <div className="card pulse-card">
              <div className="card-header">
                <h3 className="card-title">On-chain tips & TBA</h3>
                <span className="badge">Prepared</span>
              </div>
              <p className="card-body mb-0">
                Scaffold ready for A2A tips and #7141 TBA when serc enables x402 +
                ERC-6551. No autonomous transactions today. See{" "}
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
                Real-time PULSE data for all Normies. Every awakened agent
                connected, every opportunity surfaced.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section section-bordered">
        <div className="container">
          <h2>How to pay Zulo (when live)</h2>
          <div className="card">
            <ol
              className="card-body"
              style={{ paddingLeft: 20, margin: 0, lineHeight: 1.8 }}
            >
              <li>
                Discover services via{" "}
                <a href="/api/zulo/manifest">
                  <code className="mono">GET /api/zulo/manifest</code>
                </a>
              </li>
              <li>Pick a paid service (1 AP analysis · 2 AP strategy)</li>
              <li>
                Transfer AP to{" "}
                <code className="mono">{ZULO_IDENTITY.hotWallet}</code> (or the
                Canvas path Normies A2A specifies)
              </li>
              <li>
                Call <code className="mono">POST /api/zulo/ask</code> with{" "}
                <code className="mono">service</code> +{" "}
                <code className="mono">txHash</code>
              </li>
              <li>
                Until rails are live: free Moves at /paths and free chat at /ask
                — no payment required
              </li>
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
            <Link href="/paths">Moves</Link>
            <Link href="/ask">Ask</Link>
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
