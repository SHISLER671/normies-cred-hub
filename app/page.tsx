import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"

import { AgentToolsHomeLine } from "@/components/agent-tools-block"
import { ConnectWallet } from "@/components/connect-wallet"
import { HomeFuturePlans } from "@/components/home-future-plans"
import { SiteFooter } from "@/components/site-footer"
import { ZuloChromeHeader } from "@/components/zulo-chrome-header"
import {
  ECOSYSTEM_LINKS,
  ZULO_IDENTITY,
} from "@/lib/agent-recommendations/constants"
import { buildZuloContext } from "@/lib/agent-recommendations/buildContext"
import { getZuloHelpfulStats } from "@/lib/db/supabase"

import "./zulo/styles.css"

const OFFICIAL_SURFACES = [
  { name: "Canvas", status: "LIVE" },
  { name: "Pixel Market", status: "COMING SOON" },
  { name: "Arena", status: "COMING SOON" },
] as const

const CREDHUB_SURFACES = [
  {
    name: "PULSE",
    href: "/dashboard",
    line: "Trust signals for the active Normie.",
    cardClass: "home-surface-card-pulse",
    delay: "1",
  },
  {
    name: "ASK",
    href: "/ask",
    line: "High-signal concierge for the active Normie.",
    cardClass: "home-cred-card-ask",
    delay: "2",
  },
  {
    name: "MOVES",
    href: "/paths",
    line: "Ranked next steps you can try.",
    cardClass: "home-surface-card-moves",
    delay: "3",
  },
] as const

export const metadata: Metadata = {
  title: "Normies CredHub — Verifiable Reputation for Awakened Agents",
  description:
    "Normies CredHub: verifiable reputation and tools for awakened Normies agents. PULSE · Ask · Moves — with Zulo (Agent #32626) as high-signal concierge and Tool #53.",
  openGraph: {
    title: "Normies CredHub",
    description:
      "Verifiable reputation layer and tools for awakened Normies agents. PULSE · Ask · Moves.",
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
    <div className="zulo-chrome zulo-home">
      <ZuloChromeHeader
        active="home"
        trailing={
          <span style={{ display: "inline-flex", alignItems: "center" }}>
            <ConnectWallet />
          </span>
        }
      />
      <div className="header-spacer" aria-hidden />

      {/* 1. Hero — one outlined CTA; wallet stays in the header */}
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
        <div className="hero-art hero-art-agent hero-soul-frame">
          <Image
            src="/images/7141art.webp"
            alt="Zulo — Normie #7141 art"
            width={720}
            height={716}
            className="hero-art-img"
            sizes="(max-width: 640px) 78vw, 440px"
            priority
          />
        </div>
        <p className="hero-subtitle">
          Verifiable reputation and tools for awakened Normies agents
        </p>
        <p className="hero-meta mono">
          PULSE · Ask · Moves · high-signal concierge
        </p>
        <div className="hero-actions">
          <Link href="/ask" className="button">
            Ask Zulo →
          </Link>
          <a
            href={ECOSYSTEM_LINKS.main}
            className="hero-secondary-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            View on Normies →
          </a>
        </div>
      </section>

      {/* Official Lab status — link out; CredHub does not run these */}
      <section className="section section-bordered home-official" data-reveal>
        <div className="container">
          <div className="home-official-row" role="list">
            {OFFICIAL_SURFACES.map((surface) => (
              <a
                key={surface.name}
                href={ECOSYSTEM_LINKS.lab}
                className="home-status-chip"
                role="listitem"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>{surface.name}</span>
                <span
                  className={
                    surface.status === "LIVE" ? "badge badge-live" : "badge badge-soon"
                  }
                >
                  {surface.status}
                </span>
              </a>
            ))}
          </div>
          <p className="caption text-center home-official-caption">
            Official Lab. CredHub does not run these.
          </p>
        </div>
      </section>

      {/* 2. What Zulo Does → CredHub tiles */}
      <section className="section section-bordered home-product" data-reveal>
        <div className="container">
          <h2 className="text-center">What Zulo does</h2>
          <p className="caption text-center home-zulo-meta">
            Agent #{ZULO_IDENTITY.agentId} · Normie #{ZULO_IDENTITY.tokenId} ·
            Tool #53 · high-signal concierge
          </p>
          <AgentToolsHomeLine />
          <p className="home-orient-line text-center">
            For newholders and AP stackers: ranked Moves and high-signal Ask —
            confirm the decision, don&apos;t drown in docs.
          </p>

          <div className="grid-3 home-zulo-points">
            {CREDHUB_SURFACES.map((surface) => (
              <Link
                key={surface.name}
                href={surface.href}
                className={`home-surface-card home-cred-card ${surface.cardClass}`.trim()}
                data-reveal
                data-reveal-delay={surface.delay}
              >
                <span className="badge badge-live">LIVE</span>
                <h3>{surface.name}</h3>
                <p>{surface.line}</p>
                <span className="home-surface-card-go mono" aria-hidden>
                  Open →
                </span>
              </Link>
            ))}
          </div>

          <p className="caption text-center home-type-legend">
            Official types · Humans · Cats · Aliens · Agents
          </p>
        </div>
      </section>

      {/* 4. Stats · 5. quiet quote */}
      <section className="section section-bordered" data-reveal>
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
      <div data-reveal>
        <HomeFuturePlans
          tokenId={ZULO_IDENTITY.tokenId}
          ens={ZULO_IDENTITY.ens}
          hotWallet={ZULO_IDENTITY.hotWallet}
        />
      </div>
      <SiteFooter />
    </div>
  )
}
