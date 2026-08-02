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

      {/* Hub hero — CredHub first */}
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

      {/* What the hub is */}
      <section className="section section-bordered">
        <div className="container text-center" style={{ maxWidth: 720 }}>
          <h2>The hub</h2>
          <p className="card-body" style={{ fontSize: 16, marginBottom: 16 }}>
            CredHub aggregates on-chain identity, reputation, and tool access so
            holders and agents can verify trust before they interact — and grow
            beyond any single concierge or surface.
          </p>
          <p className="caption">
            Surfaces today: Moves · Ask · PULSE · ERC-8257 Tool #53
          </p>
        </div>
      </section>

      {/* Zulo — featured agent / concierge inside the hub */}
      <section className="section section-bordered">
        <div className="container">
          <p className="caption text-center" style={{ marginBottom: 12 }}>
            Featured agent inside CredHub
          </p>
          <h2 className="text-center">Zulo · Agent #{ZULO_IDENTITY.agentId}</h2>
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
            High-signal Normies concierge — awakened from Normie #
            {ZULO_IDENTITY.tokenId} ({ZULO_IDENTITY.ens}). Helps holders and
            awakened NFT agents make more informed choices for burns, trait/tool
            choices, and Canvas edits.
          </p>
          <p className="caption text-center" style={{ marginBottom: 28 }}>
            · NormiesCredHub PULSE Tool #53
          </p>

          <div className="hero-art hero-art-agent" aria-hidden={false}>
            <Image
              src="/images/7141art.png"
              alt={`Zulo — Normie #${ZULO_IDENTITY.tokenId} art`}
              width={720}
              height={720}
              className="hero-art-img"
              sizes="(max-width: 640px) 72vw, 360px"
            />
          </div>

          <h3 className="text-center" style={{ marginTop: 40, marginBottom: 24 }}>
            What Zulo does
          </h3>
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
          <cite className="quote-author">
            — Zulo, Normie #{ZULO_IDENTITY.tokenId}
          </cite>
        </blockquote>
      </section>

      <section className="section section-bordered">
        <div className="stats-grid">
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
          <div className="stat">
            <div className="stat-number">∞</div>
            <div className="stat-label">Room to grow</div>
          </div>
          <div className="stat">
            <div className="stat-number status-live">Live</div>
            <div className="stat-label">Hub surfaces</div>
          </div>
        </div>
        <p
          className="caption text-center home-rep-copy"
          style={{
            marginTop: 32,
            maxWidth: 560,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          Helpful ratings build Zulo&apos;s trackable reputation in CredHub
          today. On-chain tips and TBA rails unlock when serc enables x402 +
          ERC-6551. Moves stays free. Canvas AP shown above is #
          {ZULO_IDENTITY.tokenId}&apos;s transform budget — not tip income.
        </p>

        <div className="hero-actions" style={{ marginTop: 40 }}>
          <Link href="/paths" className="button button-arrow">
            Moves
          </Link>
          <Link href="/ask" className="button button-primary button-arrow">
            Ask
          </Link>
          <Link href="/dashboard" className="button button-pulse-cta">
            PULSE
          </Link>
        </div>
        <p className="caption text-center" style={{ marginTop: 16 }}>
          Hub surfaces — ranked paths, concierge chat, trust profiles
        </p>
      </section>

      <HomeFuturePlans
        tokenId={ZULO_IDENTITY.tokenId}
        ens={ZULO_IDENTITY.ens}
        hotWallet={ZULO_IDENTITY.hotWallet}
      />

      <footer className="site-footer">
        <div className="site-footer-inner">
          <div>Normies CredHub · part of the Normies ecosystem</div>
          <div className="footer-links">
            <Link href="/paths">Moves</Link>
            <Link href="/ask">Ask</Link>
            <Link href="/dashboard">PULSE</Link>
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
