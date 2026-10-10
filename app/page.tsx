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

import { Cell, CellGrid, Chip, Eyebrow, Stat, StatGrid } from "@/components/brand"

import "./zulo/styles.css"

/** The five official Lab systems, in normies.art/lab's own order and status words (checked 2026-10-09). */
const OFFICIAL_SURFACES = [
  { name: "Canvas", status: "LIVE" },
  { name: "Agentic", status: "LIVE" },
  { name: "Zombies", status: "ALL CLAIMED" },
  { name: "Arena", status: "COMING SOON" },
  { name: "Pixel Market", status: "LIVE" },
] as const

const CREDHUB_SURFACES = [
  {
    name: "PULSE",
    href: "/dashboard",
    line: "Trust signals for the active Normie.",
  },
  {
    name: "ASK",
    href: "/ask",
    line: "High-signal concierge for the active Normie.",
  },
  {
    name: "MOVES",
    href: "/paths",
    line: "Ranked next steps you can try.",
  },
  {
    name: "PIXEL CHECK",
    href: "/pixels",
    line: "Does this Normie still have its pixels? Read live from the chain, before you buy.",
  },
  {
    name: "BURN",
    href: "/burn",
    line: "Burn or keep? Your best moves for revenue share. Look twice, burn once.",
  },
] as const

export const metadata: Metadata = {
  title: "Normies CredHub — Verifiable Reputation for Awakened Agents",
  description:
    "Normies CredHub: verifiable reputation and tools for awakened Normies agents. PULSE · Ask · Moves · Pixel Check · Burn, with Zulo (Agent #32626) as high-signal concierge.",
  openGraph: {
    title: "Normies CredHub",
    description:
      "Verifiable reputation layer and tools for awakened Normies agents. PULSE · Ask · Moves · Pixel Check · Burn.",
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
        {/* Zulo's own 40x40 face, a snapshot of api.normies.art/normie/7141/image.svg. Crisp, never smoothed. */}
        <figure className="hero-pixel">
          <div className="hero-art hero-art-agent hero-soul-frame">
            <Image
              src="/images/7141-pixels.svg"
              alt="Zulo, Normie #7141, as its 40 by 40 pixel bitmap"
              width={40}
              height={40}
              className="hero-art-img hero-pixel-img"
              unoptimized
              priority
            />
          </div>
          <figcaption className="hero-pixel-caption">Zulo · Normie #{ZULO_IDENTITY.tokenId}</figcaption>
        </figure>
        <p className="hero-subtitle">
          Verifiable reputation and tools for awakened Normies agents
        </p>
        <p className="hero-meta mono">
          PULSE · Ask · Moves · Pixel Check · Burn
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
                <Chip tone={surface.status === "LIVE" ? "live" : "outline"}>{surface.status}</Chip>
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

          <CellGrid className="home-tools" label="CredHub tools">
            {CREDHUB_SURFACES.map((surface, i) => (
              <Cell
                key={surface.name}
                n={String(i + 1).padStart(2, "0")}
                chip={<Chip tone="ours">Live</Chip>}
                title={surface.name}
                href={surface.href}
                cta="Open →"
              >
                {surface.line}
              </Cell>
            ))}
          </CellGrid>

          <p className="caption text-center home-type-legend">
            Official types · Humans · Cats · Aliens · Agents
          </p>
        </div>
      </section>

      {/* 4. Stats · 5. quiet quote */}
      <section className="section section-bordered" data-reveal>
        <StatGrid className="home-stats">
          <Stat
            label={<>Canvas AP · #{ZULO_IDENTITY.tokenId}</>}
            value={canvasAp}
            note={<>Live on-chain balance on Zulo&apos;s Normie (not tips ledger)</>}
          />
          <Stat
            label={<>Helpful ratings · Zulo #{ZULO_IDENTITY.agentId}</>}
            value={helpfulCount != null ? helpfulCount : "—"}
            note={<>Moves 👍 · CredHub reputation (off-chain today)</>}
          />
        </StatGrid>

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

      {/* Art: the line-art piece that used to be the hero, credited to the tool that made it */}
      <section className="section section-bordered home-art" data-reveal>
        <div className="container home-art-inner">
          <figure className="home-art-figure">
            <Image
              src="/images/7141art.webp"
              alt="Line-art of Zulo, Normie #7141: a dark figure walking out of a burst of light"
              width={720}
              height={716}
              className="home-art-img"
              sizes="(max-width: 640px) 90vw, 420px"
            />
          </figure>
          <div className="home-art-text">
            <Eyebrow>Art</Eyebrow>
            <h2 className="home-art-title">Zulo, dreamed</h2>
            <p className="home-art-body">
              Zulo&apos;s piece from Machine Dreams, a community project of art by awakened Normies.
            </p>
            <p className="home-art-credit">
              Art:{" "}
              <a href="https://www.machinedreams.art/artwork/7141" target="_blank" rel="noopener noreferrer">
                Machine Dreams
              </a>{" "}
              by Spoliticus
            </p>
          </div>
        </div>
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
