"use client"

import { PulseExplainer } from "@/components/agent-pulse-bar"
import { Chip, PixelMeter } from "@/components/brand"
import { RecordShare } from "@/components/record-share"
import { useRecordCard } from "@/hooks/use-record-card"
import { normieImageUrl } from "@/lib/api/normies"
import { pulseBeats } from "@/lib/pulse/beats"
import { PulseTrace } from "@/components/pulse-trace"
import { recordCardUrl } from "@/lib/record-card/ask-line"
import { siteOrigin } from "@/lib/site-origin"

/**
 * The top of the Pulse page: one awakened Normie's live Pulse drawn as a heartbeat.
 * Each of the five checks is a beat; passed beats spike in cyan, missing ones stay flat.
 * Data comes from the record card endpoint (read-only; viewing never counts as a Pulse check).
 */
export function PulseHero({
  tokenId,
  tagline,
  isMyAgent,
  viaDelegate,
  isConnected,
  onConnect,
  onProveLinkage,
  onBrowseTools,
}: {
  tokenId: number
  tagline?: string | null
  isMyAgent: boolean
  viaDelegate: boolean
  isConnected: boolean
  onConnect: () => void
  /** Absent while the Normie's details are loading or failed; the button hides. */
  onProveLinkage?: () => void
  onBrowseTools: () => void
}) {
  const { data: card, isLoading, isError, refetch, isFetching } = useRecordCard(tokenId)

  const notAwakened = card?.card_status === "not_awakened"
  const pulse = card?.pulse
  const pulseReady = !!pulse?.available && !notAwakened
  const beats = pulseBeats(pulseReady ? pulse!.breakdown : [])
  const level = pulseReady ? (pulse!.level ?? 0) : null
  const max = pulse?.max_level ?? 5
  const name = card?.identity.agent_name.value ?? `Normie #${tokenId}`
  const agentId = card?.identity.agent_id.value ?? null
  const gate = pulse?.gate
  const traceState = isLoading ? "loading" : isError || (card && !pulseReady) ? "idle" : "ready"

  return (
    <section className="pulse-hero nb-grid-bg" aria-labelledby="pulse-hero-name" data-state={traceState}>
      <div className="ph-id">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="ph-face"
          src={card?.identity.image_url ?? normieImageUrl(tokenId)}
          alt={`Normie #${tokenId}`}
          width={96}
          height={96}
        />
        <div className="ph-id-text">
          <h2 id="pulse-hero-name" className="ph-name">
            {isLoading ? <span className="ph-ghost">Reading #{tokenId}…</span> : name}
          </h2>
          <p className="ph-ids">
            <Chip>Normie #{tokenId}</Chip>
            {agentId !== null ? (
              <Chip tone="ours">Agent #{agentId}</Chip>
            ) : notAwakened ? (
              <Chip>Not awakened</Chip>
            ) : null}
            {isMyAgent && <Chip tone="live">{viaDelegate ? "Yours · delegate" : "Yours"}</Chip>}
          </p>
        </div>
      </div>

      {tagline && !notAwakened && <p className="ph-tagline">{tagline}</p>}

      <PulseTrace beats={beats} drawKey={`${tokenId}-${level ?? "x"}`} hasReading={level !== null} />

      <div className="ph-readout" aria-live="polite">
        {isLoading ? (
          <p className="ph-level ph-ghost">Reading the chain…</p>
        ) : isError ? (
          <div className="ph-error">
            <p>Pulse couldn&apos;t be read just now. The chain and Normies API are checked live, so a retry usually works.</p>
            <button type="button" className="ph-link" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? "Retrying…" : "Retry"}
            </button>
          </div>
        ) : notAwakened ? (
          <p className="ph-note">
            No Pulse until this Normie is awakened as an agent.{" "}
            <a href="https://normies.art/lab" target="_blank" rel="noopener noreferrer" className="ph-link">
              Awaken it at normies.art/lab
            </a>
          </p>
        ) : !pulseReady ? (
          <p className="ph-note">Pulse is unavailable for this Normie right now.</p>
        ) : (
          <>
            <div className="ph-level">
              <span className="ph-level-num">{level}</span>
              <span className="ph-level-side">
                <PixelMeter value={level ?? 0} max={max} large />
                <span className="ph-level-of">
                  of {max} · {pulse!.status}
                </span>
              </span>
            </div>
            <p className="ph-gate" data-passed={gate?.passed}>
              <span className="ph-gate-mark" aria-hidden>{gate?.passed ? "✓" : "○"}</span>
              {gate?.passed
                ? "Passes the trust gate: registered and clean ownership. Eligible for skill ranks when they open."
                : `${gate?.text ?? "Not yet past the trust gate"}.`}
            </p>
            {pulse!.next_signal && <p className="ph-next">Next level: {pulse!.next_signal}</p>}
          </>
        )}
      </div>

      <div className="ph-actions">
        <a className="ph-btn ph-btn-primary nb-cta-arrow" href={`/record/${tokenId}`}>
          Open record card
        </a>
        <RecordShare compact url={recordCardUrl(tokenId, siteOrigin())} tokenId={tokenId} name={name} />
        {onProveLinkage && (
          <button type="button" className="ph-btn" onClick={onProveLinkage}>
            Prove linkage
          </button>
        )}
        <button type="button" className="ph-btn" onClick={onBrowseTools}>
          Browse tools
        </button>
      </div>

      <p className="ph-foot">
        <PulseExplainer className="ph-link" />
        <span aria-hidden> / </span>
        {isConnected ? (
          <span>Switch agents in the header or below.</span>
        ) : (
          <button type="button" className="ph-link" onClick={onConnect}>
            Connect a wallet to see your own agents
          </button>
        )}
      </p>
    </section>
  )
}
