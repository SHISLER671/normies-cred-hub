"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useId, useRef, useState } from "react"

import { useActiveNormie } from "@/components/active-normie-provider"
import { Chip, PixelMeter } from "@/components/brand"
import { PulseTrace } from "@/components/pulse-trace"
import { useRecordCard } from "@/hooks/use-record-card"
import { normieImageUrl } from "@/lib/api/normies"
import { pulseBeats } from "@/lib/pulse/beats"
import type { RecordCard } from "@/lib/record-card/types"

const DEBOUNCE_MS = 450

function parseId(raw: string): number | null {
  if (!/^\d{1,4}$/.test(raw)) return null
  const n = Number.parseInt(raw, 10)
  return n >= 0 && n <= 9999 ? n : null
}

/**
 * Homepage hero: a live heart monitor for any Normie. Type a token id and the trace redraws into that Normie's
 * real Pulse, read from the record card endpoint (read-only, no wallet, never counts as a Pulse check).
 */
export function HomeHeartbeat({ defaultTokenId, initialCard }: { defaultTokenId: number; initialCard: RecordCard | null }) {
  const router = useRouter()
  const inputId = useId()
  const { controlledNormies, hasWallet, setActiveTokenId } = useActiveNormie()

  const [raw, setRaw] = useState(String(defaultTokenId))
  const [tokenId, setTokenId] = useState(defaultTokenId)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const parsed = parseId(raw.trim())
  const invalid = raw.trim() !== "" && parsed === null

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (parsed === null || parsed === tokenId) return
    timer.current = setTimeout(() => setTokenId(parsed), DEBOUNCE_MS)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [parsed, tokenId])

  const { data: card, isLoading, isError, refetch, isFetching } = useRecordCard(tokenId, initialCard)

  const notAwakened = card?.card_status === "not_awakened"
  const pulse = card?.pulse
  const ready = !!pulse?.available && !notAwakened
  const beats = pulseBeats(ready ? pulse!.breakdown : [])
  const level = ready ? (pulse!.level ?? 0) : null
  const name = card?.identity.agent_name.value ?? `Normie #${tokenId}`
  const agentId = card?.identity.agent_id.value ?? null
  const state = isLoading || (parsed !== null && parsed !== tokenId) ? "loading" : ready ? "ready" : "idle"

  function check(id: number) {
    if (timer.current) clearTimeout(timer.current)
    setRaw(String(id))
    setTokenId(id)
  }

  function openPulse() {
    setActiveTokenId(tokenId)
    router.push("/dashboard")
  }

  const mine = hasWallet ? controlledNormies.filter((n) => n.tokenId !== tokenId).slice(0, 6) : []

  return (
    <section className="hh nb-grid-bg" aria-labelledby="hh-title" data-state={state}>
      <div className="hh-head">
        <p className="hh-tags">
          <Chip>Read live from Ethereum</Chip>
          <Chip>Read-only · no wallet</Chip>
        </p>
        <h1 id="hh-title" className="hh-title">Every awakened Normie has a pulse.</h1>
        <p className="hh-lede">
          Type any Normie to see whether it can be trusted, read live from Ethereum. No wallet needed.
        </p>

        <form
          className="hh-form"
          role="search"
          onSubmit={(e) => {
            e.preventDefault()
            if (parsed !== null) check(parsed)
          }}
        >
          <label htmlFor={inputId} className="sr-only">Normie number, 0 to 9999</label>
          <span className="hh-hash" aria-hidden>#</span>
          <input
            id={inputId}
            className="hh-input"
            value={raw}
            onChange={(e) => setRaw(e.target.value.replace(/[^\d]/g, "").slice(0, 4))}
            inputMode="numeric"
            autoComplete="off"
            enterKeyHint="go"
            aria-invalid={invalid}
            aria-describedby={`${inputId}-hint`}
          />
          <button type="submit" className="hh-go" disabled={parsed === null}>Check</button>
        </form>
        <p id={`${inputId}-hint`} className="hh-hint">
          {invalid ? (
            "Normies run from #0 to #9999."
          ) : (
            <>
              {tokenId !== defaultTokenId && (
                <button type="button" className="hh-chip" onClick={() => check(defaultTokenId)}>
                  Zulo · #{defaultTokenId}
                </button>
              )}
              {mine.map((n) => (
                <button key={n.tokenId} type="button" className="hh-chip" onClick={() => check(n.tokenId)}>
                  Yours · #{n.tokenId}
                </button>
              ))}
              {tokenId === defaultTokenId && mine.length === 0 && <span>Showing Zulo, our concierge. Try any number.</span>}
            </>
          )}
        </p>
      </div>

      <PulseTrace
        className="hh-trace"
        beats={beats}
        drawKey={`${tokenId}-${level ?? "x"}-${card?.generated_at ?? ""}`}
        hasReading={level !== null}
        blip
      />

      <div className="hh-result" aria-live="polite">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="hh-face" src={card?.identity.image_url ?? normieImageUrl(tokenId)} alt="" width={64} height={64} />
        <div className="hh-result-text">
          <p className="hh-name">
            {isLoading ? <span className="hh-muted">Reading #{tokenId}…</span> : name}
            {agentId !== null && <span className="hh-agent">Agent #{agentId}</span>}
          </p>
          {isError ? (
            <p className="hh-line">
              Couldn&apos;t read #{tokenId} just now.{" "}
              <button type="button" className="hh-link" onClick={() => refetch()} disabled={isFetching}>
                {isFetching ? "Retrying…" : "Retry"}
              </button>
            </p>
          ) : isLoading ? (
            <p className="hh-line hh-muted">Checking the registry, ownership and canvas…</p>
          ) : notAwakened ? (
            <p className="hh-line">Not awakened yet, so no pulse. Awakened Normies get a record here automatically.</p>
          ) : !ready ? (
            <p className="hh-line hh-muted">Pulse is unavailable for #{tokenId} right now.</p>
          ) : (
            <p className="hh-line">
              <PixelMeter value={level ?? 0} max={pulse!.max_level} />
              <strong className="hh-level">{level} of {pulse!.max_level} · {pulse!.status}</strong>
              <span data-passed={pulse!.gate.passed} className="hh-gate">
                {pulse!.gate.passed ? "Passes the trust gate" : "Not past the trust gate yet"}
              </span>
            </p>
          )}
        </div>
        <div className="hh-actions">
          <Link className="hh-btn hh-btn-primary nb-cta-arrow" href={`/record/${tokenId}`}>Record card</Link>
          <button type="button" className="hh-btn" onClick={openPulse}>Full Pulse</button>
        </div>
      </div>
    </section>
  )
}
