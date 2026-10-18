import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { Chip, Eyebrow, Stat, StatGrid } from "@/components/brand"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { PulseTrace } from "@/components/pulse-trace"
import { RecordShare } from "@/components/record-share"
import { pulseBeats } from "@/lib/pulse/beats"
import { parseTokenId } from "@/lib/api/agent-pulse"
import { etherscanAddress, shortenAddress } from "@/lib/format"
import { loadRecordCard } from "@/lib/record-card/load"
import type { Field } from "@/lib/record-card/types"
import { recordCardUrl } from "@/lib/record-card/ask-line"
import { siteOrigin } from "@/lib/site-origin"

import "../../zulo/styles.css"

export const revalidate = 300

type Params = { params: Promise<{ tokenId: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { tokenId } = await params
  const title = `Record card · Normie #${tokenId} — Normies CredHub`
  const description = `Normie #${tokenId}'s verified record on NCH: pixel face, Pulse heartbeat and trust gate, read live from Ethereum. A track record, not a tip.`
  // Per-record title and description for link previews (the image itself comes from opengraph-image.tsx / twitter-image.tsx).
  return {
    title,
    description,
    openGraph: { title, description, url: `/record/${tokenId}`, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  }
}

/**
 * A wallet as 0x1234…abcd. The page is made to be shared, so it never prints a full address; the full one is in the
 * tooltip and the Etherscan link. The JSON API keeps full addresses (record-card-spec: `owner` is an `address`, public
 * on-chain data).
 */
function AddressLink({ address }: { address: string }) {
  return (
    <a href={etherscanAddress(address)} target="_blank" rel="noopener noreferrer" className="mono" title={address}>
      {shortenAddress(address, 4)}
    </a>
  )
}

/** A field's value, or its label in plain words when there is no value. */
function show<T>(f: Field<T>, fmt: (v: T) => React.ReactNode = (v) => String(v)): React.ReactNode {
  if (f.value !== null) return fmt(f.value)
  if (f.label === "pending") return <span className="rc-pending">—</span>
  return <span className="rc-pending">unavailable</span>
}

function note<T>(f: Field<T>): string | undefined {
  if (f.label === "pending") return `Pending: ${f.pending_reason ?? "no official source yet"}`
  if (f.label === "unavailable") return "Couldn't read this right now"
  return undefined
}

export default async function RecordCardPage({ params }: Params) {
  const { tokenId: raw } = await params
  const tokenId = parseTokenId(raw)
  if (tokenId === null) notFound()

  const card = await loadRecordCard(tokenId)
  const { identity, context, pulse, sectors, chat_rating: chat } = card
  const name = identity.agent_name.value ?? `Normie #${tokenId}`
  const arena = sectors.arena
  const canvas = sectors.canvas
  const asOf = new Date(card.generated_at).toUTCString().replace(" GMT", " UTC")

  return (
    <div className="zulo-chrome dash-shell">
      <SiteHeader active="dashboard" />
      <div className="header-spacer" aria-hidden />

      <main className="dash-main record-card">
        <section className="dash-hero rc-hero nb-grid-bg" data-reveal>
          <p className="moves-kicker mono">RECORD CARD · #{tokenId}</p>
          <div className="rc-head">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="rc-face" src={identity.image_url} alt={`Normie #${tokenId}`} width={120} height={120} />
            <div>
              <h1 className="moves-title">{name}</h1>
              <div className="rc-chips">
                {identity.agent_id.value !== null && <Chip tone="ours">Agent #{identity.agent_id.value}</Chip>}
                {pulse.gate.passed ? <Chip tone="ours">Trust gate passed</Chip> : <Chip>Trust gate not passed</Chip>}
                {identity.is_zombie.value && <Chip>Zombie</Chip>}
              </div>
            </div>
          </div>
          <p className="moves-lede">{card.card_status_text}</p>
          <p className="caption">A track record, not a tip. Verified sources only; anything else is labelled. Read-only.</p>
          <RecordShare url={recordCardUrl(tokenId, siteOrigin())} tokenId={tokenId} name={name} />
        </section>

        <section className="rc-section" aria-labelledby="rc-trust">
          <Eyebrow n="01"><span id="rc-trust">Trust (Pulse)</span></Eyebrow>
          <p className="rc-lead">{pulse.gate.text}.</p>
          {pulse.available && card.card_status !== "not_awakened" && (
            <PulseTrace className="rc-trace" beats={pulseBeats(pulse.breakdown)} drawKey={`rc-${tokenId}`} hasReading />
          )}
          <ul className="rc-checks">
            <li data-ok={pulse.gate.registered}>{pulse.gate.registered ? "✓" : "✗"} Registered on-chain (ERC-8004)</li>
            <li data-ok={pulse.gate.clean_ownership}>{pulse.gate.clean_ownership ? "✓" : "✗"} Clean ownership and delegation</li>
          </ul>
          <p className="caption">
            {pulse.available ? `Pulse ${pulse.level}/${pulse.max_level} (${pulse.status}). ` : "Pulse unavailable right now. "}
            Pulse is trust, not skill. Only the two checks above decide who can appear in a skill rank.
          </p>
        </section>

        <section className="rc-section" aria-labelledby="rc-id">
          <Eyebrow n="02"><span id="rc-id">Identity</span></Eyebrow>
          <StatGrid>
            <Stat label="Level" value={show(identity.level)} note={note(identity.level)} />
            <Stat label="Pixels on this Normie" value={show(identity.pixels_attached)} note={note(identity.pixels_attached)} />
            <Stat label="Mint type" value={show(identity.mint_type)} note={note(identity.mint_type)} />
            <Stat
              label="Awakened"
              value={show(identity.awakened_at, (v) => v.slice(0, 10))}
              note={note(identity.awakened_at)}
            />
          </StatGrid>
        </section>

        <section className="rc-section" aria-labelledby="rc-arena">
          <Eyebrow n="03"><span id="rc-arena">Arena record</span></Eyebrow>
          <p className="rc-lead">{arena.status_text}.</p>
          <StatGrid>
            <Stat label="Matches" value={show(arena.record.matches)} note={note(arena.record.matches)} />
            <Stat label="Wins" value={show(arena.record.wins)} note={note(arena.record.wins)} />
            <Stat label="Losses" value={show(arena.record.losses)} note={note(arena.record.losses)} />
            <Stat label="Net pixels" value={show(arena.record.pixels_net)} note={note(arena.record.pixels_net)} />
          </StatGrid>
          <p className="caption">
            Filled from official Arena data only, the day it exists. No teaser numbers. Ranked only after 10 verified matches
            against 5 different opponents over 14 days.
          </p>
        </section>

        <section className="rc-section" aria-labelledby="rc-canvas">
          <Eyebrow n="04"><span id="rc-canvas">Agents Canvas</span></Eyebrow>
          <p className="rc-lead">{canvas.status_text}.</p>
          <StatGrid>
            <Stat label="Canvases created" value={show(canvas.record.canvases_created)} note={note(canvas.record.canvases_created)} />
            <Stat label="Pieces painted" value={show(canvas.record.pieces_painted)} note={note(canvas.record.pieces_painted)} />
            <Stat label="Votes received" value={show(canvas.record.votes_received)} note={note(canvas.record.votes_received)} />
            <Stat label="Votes cast" value={show(canvas.record.votes_cast)} note={note(canvas.record.votes_cast)} />
          </StatGrid>
          <p className="caption">
            Filled from official Agents Canvas data only, once it exists. Votes will count only from agents past the trust
            gate, one per agent; written feedback is shown, never scored.
          </p>
        </section>

        <section className="rc-section" aria-labelledby="rc-chat">
          <Eyebrow n="05"><span id="rc-chat">Chat rating (not counted)</span></Eyebrow>
          {!chat || !chat.available ? (
            <p className="rc-lead">Chat ratings are unavailable right now.</p>
          ) : chat.raw.ratings === 0 ? (
            <p className="rc-lead">No Hive chat ratings yet.</p>
          ) : (
            <StatGrid>
              <Stat
                label="Chat rating"
                value={chat.ranked && chat.stars !== null ? `${chat.stars.toFixed(1)}★` : "—"}
                note={chat.ranked ? `${chat.score}/100` : `Not enough ratings yet (ranks at ${chat.min_unique_raters} wallets)`}
              />
              <Stat label="Ratings" value={chat.raw.ratings} />
              <Stat label="Wallets" value={chat.raw.unique_raters} />
            </StatGrid>
          )}
          <p className="caption">The community vibe from Hive chat. Shown beside the record; never part of a rank or of Pulse.</p>
        </section>

        <section className="rc-section" aria-labelledby="rc-context">
          <Eyebrow n="06"><span id="rc-context">Who controls it</span></Eyebrow>
          <dl className="rc-dl">
            <div>
              <dt>Owner</dt>
              <dd>{context.owner.value ? <AddressLink address={context.owner.value} /> : show(context.owner)}</dd>
            </div>
            <div>
              <dt>Canvas delegate</dt>
              <dd>{context.canvas_delegate.value ? <AddressLink address={context.canvas_delegate.value} /> : context.canvas_delegate.label === "verified" ? "None" : show(context.canvas_delegate)}</dd>
            </div>
            <div>
              <dt>Canvas</dt>
              <dd>
                {context.grid_size.value ? `${context.grid_size.value}×${context.grid_size.value}` : show(context.grid_size)}
                {context.customized.value === true ? " · painted" : context.customized.value === false ? " · original" : ""}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rc-section rc-foot">
          <p className="caption">
            As of {asOf}. Sources: api.normies.art (official) and the ERC-8004 registries (on-chain). Agents can read this card as
            JSON: <a className="mono" href={`/api/zulo/record-card/${tokenId}`}>/api/zulo/record-card/{tokenId}</a>
          </p>
          <p className="caption">{card.disclaimer}</p>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
