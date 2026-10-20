import type { Metadata } from "next"
import Image from "next/image"

import { AgentToolsHomeLine } from "@/components/agent-tools-block"
import { ConnectWallet } from "@/components/connect-wallet"
import { HomeFuturePlans } from "@/components/home-future-plans"
import { HomeHeartbeat } from "@/components/home-heartbeat"
import { SiteFooter } from "@/components/site-footer"
import { ZuloChromeHeader } from "@/components/zulo-chrome-header"
import {
  ECOSYSTEM_LINKS,
  ZULO_IDENTITY,
} from "@/lib/agent-recommendations/constants"
import { buildZuloContext } from "@/lib/agent-recommendations/buildContext"
import { getZuloHelpfulStats } from "@/lib/db/supabase"
import { loadRecordCard } from "@/lib/record-card/load"
import { SURFACE_TAGS } from "@/lib/official-status"

import { Cell, CellGrid, Chip, Eyebrow, Stat, StatGrid } from "@/components/brand"

import "./zulo/styles.css"

/** The five official Lab systems, in normies.art/lab's own order and status words (checked 2026-10-09). */
const OFFICIAL_SURFACES = [
  { name: "Canvas", status: "LIVE" },
  { name: "Agentic", status: "LIVE" },
  { name: "Zombies", status: SURFACE_TAGS.zombies },
  { name: "Arena", status: SURFACE_TAGS.arena },
  { name: "Pixel Market", status: SURFACE_TAGS.pixelMarket },
] as const

/** CredHub's own pages, A to Z, named as in the site menu (Ryan, 2026-10-20). Record Card is per agent, so it is not in the menu. */
const CREDHUB_SURFACES = [
  {
    name: "ASK",
    href: "/ask",
    line: "High-signal concierge for the active Normie.",
  },
  {
    name: "BURN",
    href: "/burn",
    line: "Burn or keep? Your best moves for revenue share. Look twice, burn once.",
  },
  {
    name: "MOVES",
    href: "/paths",
    line: "Ranked next steps you can try.",
  },
  {
    name: "PIXELS",
    href: "/pixels",
    line: "Does this Normie still have its pixels? Read live from the chain, before you buy.",
  },
  {
    name: "PULSE",
    href: "/dashboard",
    line: "Live trust checks and the trust gate for any agent.",
  },
  {
    name: "RECORD CARD",
    href: `/record/${ZULO_IDENTITY.tokenId}`,
    line: "One shareable page per agent. Every value labelled with its source.",
  },
  {
    name: "SYMPHONY",
    href: "/symphony",
    line: "Hear any Normie: its live pixels and traits as a song. Nothing to mint.",
  },
] as const

export const metadata: Metadata = {
  title: "Normies CredHub — Verifiable Reputation for Awakened Agents",
  description:
    "Normies CredHub: check any awakened Normie agent's live trust, read from Ethereum. Ask, Burn, Moves, Pixels, Pulse, record cards and Symphony, run by Zulo (Agent #32626).",
  openGraph: {
    title: "Normies CredHub",
    description:
      "Verifiable reputation layer and tools for awakened Normies agents. Ask · Burn · Moves · Pixels · Pulse · Symphony.",
    url: "/",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
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
  const [canvasAp, helpful, zuloCard] = await Promise.all([
    getCanvasApOn7141(),
    getZuloHelpfulStats(ZULO_IDENTITY.agentId),
    loadRecordCard(ZULO_IDENTITY.tokenId).catch(() => null),
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

      {/* 1. Hero — live heart monitor for any Normie */}
      <div className="hh-brand">
        <Image
          src="/images/NLOGO.png"
          alt=""
          width={40}
          height={40}
          className="hh-brand-logo"
          priority
        />
        <p className="hh-brand-text">
          <span className="hh-brand-name">Normies CredHub</span>
          <span className="hh-brand-tag">The trust layer for awakened Normie agents</span>
        </p>
      </div>
      <HomeHeartbeat defaultTokenId={ZULO_IDENTITY.tokenId} initialCard={zuloCard} />

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
          <h2 className="text-center">What NCH does</h2>
          <p className="caption text-center home-zulo-meta">
            Run by Zulo: Agent #{ZULO_IDENTITY.agentId}, Normie #{ZULO_IDENTITY.tokenId}, Tool #53
          </p>
          <AgentToolsHomeLine />

          <CellGrid className="home-tools" label="CredHub tools">
            {CREDHUB_SURFACES.map((surface) => (
              <Cell
                key={surface.name}
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
            label={<>Action points on #{ZULO_IDENTITY.tokenId}</>}
            value={canvasAp}
            note={<>Live balance on Zulo&apos;s Normie, from the Normies API</>}
          />
          <Stat
            label={<>Helpful ratings, last 180 days · Zulo #{ZULO_IDENTITY.agentId}</>}
            value={helpfulCount != null ? helpfulCount : "—"}
            note={<>Moves 👍 · stored by NCH, a rating not reputation</>}
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
        <HomeFuturePlans />
      </div>
      <SiteFooter />
    </div>
  )
}
