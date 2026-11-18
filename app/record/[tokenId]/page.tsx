import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { Chip, Eyebrow, Stat, StatGrid } from "@/components/brand"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { PulseTrace } from "@/components/pulse-trace"
import { RecordShare } from "@/components/record-share"
import { ArenaRoundHistoryList } from "@/components/arena-round-history"
import { LocalTime } from "@/components/arena-live"
import { ArenaSkin } from "@/components/arena-skin"
import { publicClient } from "@/lib/viem-client"
import { symphonyPath } from "@/lib/symphony/pin"
import { popularityCountsText, pulseBeats, TRENDING_LABEL } from "@/lib/pulse/beats"
import { parseTokenId } from "@/lib/api/agent-pulse"
import { etherscanAddress, shortenAddress } from "@/lib/format"
import { ARENA_RANK_MINIMUM } from "@/lib/record-card/arena"
import { loadRecordCard } from "@/lib/record-card/load"
import { typeDisplay } from "@/lib/record-card/build"
import { ARENA_ARTICLE, ARENA_ENTER_SOURCE, ARENA_MAY_CHANGE, arenaCardFacts } from "@/lib/arena-canon"
import { ARENA_SITE } from "@/lib/official-status"
import type { Field } from "@/lib/record-card/types"
import { recordCardUrl } from "@/lib/record-card/ask-line"
import { siteOrigin } from "@/lib/site-origin"

import "../../zulo/styles.css"

export const revalidate = 300

type Params = { params: Promise<{ tokenId: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { tokenId: raw } = await params
  const tokenId = parseTokenId(raw)
  if (tokenId === null) return { title: "Record card not found — Normies CredHub", robots: { index: false } }
  const title = `Record card · Normie #${tokenId} — Normies CredHub`
  const description = `Normie #${tokenId}'s verified record on NCH: pixel face, Pulse heartbeat and trust gate, read live from Ethereum. A track record, not a tip.`
  // Per-record title and description for link previews (the image itself comes from opengraph-image.tsx / twitter-image.tsx).
  return {
    title,
    description,
    alternates: { canonical: `/record/${tokenId}` },
    openGraph: { title, description, url: `/record/${tokenId}`, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  }
}

/**
 * A wallet as 0x1234…abcd. The page is made to be shared, so it never prints a full address; the full one is in the
 * tooltip and the Etherscan link. The JSON API keeps full addresses (record-card-spec: `owner` is an `address`, public
 * on-chain data).
 */
function AddressLink({ address, ens }: { address: string; ens?: string | null }) {
  return (
    <a href={etherscanAddress(address)} target="_blank" rel="noopener noreferrer" className="mono" title={ens ?? address}>
      {ens ?? shortenAddress(address, 4)}
    </a>
  )
}

/**
 * Primary ENS name for an address (public, published on-chain by the owner), or null. Best effort: 2.5s timeout,
 * any error → null, so the page falls back to the short address.
 */
async function ensNameFor(address: string | null | undefined): Promise<string | null> {
  if (!address) return null
  try {
    const name = await Promise.race([
      publicClient.getEnsName({ address: address as `0x${string}` }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
    ])
    return name ?? null
  } catch {
    return null
  }
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
  if (f.label === "round in progress") return "Round in progress: this count can still change"
  return undefined
}

export default async function RecordCardPage({ params }: Params) {
  const { tokenId: raw } = await params
  const tokenId = parseTokenId(raw)
  if (tokenId === null) notFound()

  const card = await loadRecordCard(tokenId)
  const { identity, context, pulse, sectors, chat_rating: chat } = card
  const [ownerEns, delegateEns] = await Promise.all([
    ensNameFor(context.owner.value),
    ensNameFor(context.canvas_delegate.value),
  ])
  const name = identity.agent_name.value ?? `Normie #${tokenId}`
  const arena = sectors.arena
  const canvas = sectors.canvas
  const canvasRank = identity.arena_canvas_rank ?? null
  // Official type and head-start facts for this Normie's type and Level. Shown under the record, never as one.
  // Current type only: a Zombie minted Human must never show Human stats, so an unknown type shows no type line.
  const arenaFacts = arenaCardFacts(identity.type?.value ?? null, identity.level.value)
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
          <RecordShare url={recordCardUrl(tokenId, siteOrigin())} tokenId={tokenId} name={name} listenHref={symphonyPath([tokenId], null)} />
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
          {pulse.popularity && (
            <p className="caption">
              {pulse.trending && (
                <>
                  <Chip tone="live">{TRENDING_LABEL}</Chip>{" "}
                </>
              )}
              {popularityCountsText(pulse.popularity)}. Popularity is separate from trust and never changes the Pulse level.
            </p>
          )}
        </section>

        <section className="rc-section" aria-labelledby="rc-id">
          <Eyebrow n="02"><span id="rc-id">Identity</span></Eyebrow>
          <StatGrid>
            <Stat label="Level" value={show(identity.level)} note={note(identity.level)} />
            <Stat label="Pixels on this Normie" value={show(identity.pixels_attached)} note={note(identity.pixels_attached)} />
            {canvasRank && (
              <Stat label="Arena Canvas rank" value={show(canvasRank)} note={note(canvasRank)} />
            )}
            <Stat
              label="Type"
              value={typeDisplay(identity) ?? show(identity.mint_type)}
              note={note(identity.type?.value ? identity.type : identity.mint_type)}
            />
            <Stat
              label="Awakened"
              value={show(identity.awakened_at, (v) => v.slice(0, 10))}
              note={note(identity.awakened_at)}
            />
          </StatGrid>
          {canvasRank?.note && (
            <p className="caption">
              Arena Canvas rank: {canvasRank.note}{" "}
              <a href={canvasRank.source_url} target="_blank" rel="noopener noreferrer">Source</a>
            </p>
          )}
        </section>

        <section className="rc-section" aria-labelledby="rc-arena">
          <Eyebrow n="03"><span id="rc-arena">Arena record</span></Eyebrow>
          <p className="rc-lead">{arena.status_text}.</p>
          <StatGrid>
            {arena.entry && (
              <Stat
                label="In Arena"
                value={arena.entry.entered.value === null ? "—" : arena.entry.entered.value ? "Entered" : "Not entered"}
                note={note(arena.entry.entered)}
              />
            )}
            {arena.entry?.state && <Stat label="Arena state" value={show(arena.entry.state)} note={note(arena.entry.state)} />}
            {arena.entry?.agent_id && <Stat label="Arena agent" value={show(arena.entry.agent_id, (id) => `#${id}`)} note={note(arena.entry.agent_id)} />}
            {arena.entry?.skins && <Stat label="Skins" value={show(arena.entry.skins)} note={note(arena.entry.skins)} />}
            <Stat label="Rounds played" value={show(arena.record.matches)} note={note(arena.record.matches)} />
            <Stat label="Wins" value={show(arena.record.wins)} note={note(arena.record.wins)} />
            <Stat label="Losses" value={show(arena.record.losses)} note={note(arena.record.losses)} />
            {arena.record.prize_won && <Stat label="Prize won" value={show(arena.record.prize_won)} note={note(arena.record.prize_won)} />}
          </StatGrid>
          {arena.round_history && <ArenaRoundHistoryList history={arena.round_history} />}
          {arena.round_pool && (
            <p className="caption" style={{ marginTop: 20 }}>
              {arena.round_pool.text}. {arena.round_pool.note} Don&apos;t take our word for it:{" "}
              <a href={arena.round_pool.source.url} target="_blank" rel="noopener noreferrer">check the official Arena data</a>.
            </p>
          )}
          {arena.live && (
            <div style={{ marginTop: 20 }}>
              <p className="rc-lead" style={{ marginBottom: 8 }}>
                <strong>Live in the Arena.</strong>{" "}
                {arena.live.status === "ok" ? `${arena.live.status_text}. It can change until the round ends.` : `${arena.live.status_text}.`}
              </p>
              {arena.live.status === "ok" && (
                <StatGrid>
                  <Stat label="Arena's live standing" value={arena.live.live_rank.text} note="As the Arena reports it. Not an NCH rank" />
                  <Stat label="Arena score" value={arena.live.live_score_px.toLocaleString("en-US")} note="Arena PX, the game's own score. Not #PIXEL" />
                  <Stat label="Right now" value={arena.live.where_text} note={arena.live.back_at ? <>Due back <LocalTime iso={arena.live.back_at} /></> : undefined} />
                  <Stat label="Kills" value={arena.live.kills} />
                  <Stat label="Deaths" value={arena.live.deaths} />
                  <Stat label="Duels won" value={arena.live.duels_won} note="Wins against other agents, as the Arena counts them" />
                  <Stat label="Round" value={`Game ${arena.live.round.game}`} note={`Phase, as reported: ${arena.live.round.phase}. ${arena.live.round.players} players`} />
                  <Stat label="Round ends" value={<LocalTime iso={arena.live.round.ends_at} />} note="Shown in your local time" />
                </StatGrid>
              )}
              <p className="caption">
                {arena.live.status === "ok" ? `${arena.live.note} ` : ""}
                Source: {arena.live.source.label}, as of {new Date(arena.live.as_of).toUTCString().replace(" GMT", " UTC")}.
              </p>
            </div>
          )}
          {arena.skin_image_url && <ArenaSkin src={arena.skin_image_url} tokenId={card.token_id} profileUrl={arena.profile_url} />}
          <p className="caption">
            {arena.profile_url && (
              <>
                <a href={arena.profile_url} target="_blank" rel="noopener noreferrer">Its life in the Arena</a> (story, standing, friends
                and grudges).{" "}
              </>
            )}
            {context.owner.label === "verified" && context.owner.value && (
              <>
                <a href={`/arena?wallet=${context.owner.value}`}>This wallet&apos;s Normies in the Arena</a> (
                <span className="mono">{ownerEns ?? shortenAddress(context.owner.value, 4)}</span>).{" "}
              </>
            )}
            {arena.watch_url && (
              <>
                <a href={arena.watch_url} target="_blank" rel="noopener noreferrer">Watch live</a> on the official Arena map.{" "}
              </>
            )}
            The record is official Arena data only (api.normies.art){arena.live ? "; the live block is the Arena site's own data (arena.normies.art)" : ""}. Being registered is not a record, and nothing here is a guess. Ranked
            only after {ARENA_RANK_MINIMUM.rounds} verified rounds and {ARENA_RANK_MINIMUM.days} days since its first round, and only past the
            trust gate; see the <a href="/arena/rank">Arena rank page</a>. To enter, go to{" "}
            <a href={ARENA_SITE} target="_blank" rel="noopener noreferrer">arena.normies.art</a>; NCH can&apos;t enter anyone.
          </p>
          {(arenaFacts.type || arenaFacts.headStart) && (
            <>
              <StatGrid>
                {arenaFacts.type && <Stat label="Type in Arena" value={arenaFacts.type.value} note={arenaFacts.type.note} />}
                {arenaFacts.headStart && (
                  <Stat label="Head start" value={arenaFacts.headStart.value} note={arenaFacts.headStart.note} />
                )}
              </StatGrid>
              <p className="caption">
                Head start from{" "}
                <a href={ARENA_ENTER_SOURCE} target="_blank" rel="noopener noreferrer">the official Arena entry page</a>
                {arenaFacts.type ? (
                  <>. Type stats from <a href={ARENA_ARTICLE.url} target="_blank" rel="noopener noreferrer">normiesART&apos;s Arena article</a> ({ARENA_ARTICLE.publishedText})</>
                ) : null}
                {". Not a record. "}{ARENA_MAY_CHANGE}. A head start, not a guarantee.
              </p>
            </>
          )}
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
              <dd>{context.owner.value ? <AddressLink address={context.owner.value} ens={ownerEns} /> : show(context.owner)}</dd>
            </div>
            <div>
              <dt>Canvas delegate</dt>
              <dd>{context.canvas_delegate.value ? <AddressLink address={context.canvas_delegate.value} ens={delegateEns} /> : context.canvas_delegate.label === "verified" ? "None" : show(context.canvas_delegate)}</dd>
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
