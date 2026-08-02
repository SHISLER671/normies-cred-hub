"use client"

import { useCallback, useEffect, useState } from "react"
import { useAccount } from "wagmi"

import type { IntentTag, RankedPath, RankPathsResult } from "@/lib/path-ranker"
import { useWalletGate } from "@/components/wallet-gate"

import { IntentChips } from "./intent-chips"
import { PathCard } from "./path-card"

const MAX_INTENT = 200

const REPUTATION_NOTE =
  "Ratings build Zulo’s trackable reputation in CredHub today. On-chain tips and TBA rails activate when serc enables x402 + ERC-6551 for #7141."

export function PathBoard({
  defaultTokenId,
}: {
  defaultTokenId?: number
}) {
  const { address } = useAccount()
  const { promptConnect } = useWalletGate()
  const [intentTag, setIntentTag] = useState<IntentTag | null>(null)
  const [intent, setIntent] = useState("")
  const [tokenId, setTokenId] = useState(
    defaultTokenId != null ? String(defaultTokenId) : "",
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<RankPathsResult | null>(null)
  const [helpfulCount, setHelpfulCount] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch("/api/zulo/feedback")
        const data = (await res.json()) as {
          ok?: boolean
          helpfulCount?: number
        }
        if (
          !cancelled &&
          res.ok &&
          data.ok &&
          typeof data.helpfulCount === "number"
        ) {
          setHelpfulCount(data.helpfulCount)
        }
      } catch {
        /* soft stats optional on load */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const runRank = useCallback(
    async (opts?: { tag?: IntentTag; text?: string }) => {
      const tag = opts?.tag ?? intentTag ?? undefined
      const text = (opts?.text ?? intent).trim()
      if (!tag && !text) {
        setError("Pick a chip or describe the job in one sentence.")
        return
      }

      setLoading(true)
      setError(null)

      const parsedToken =
        tokenId.trim() === ""
          ? undefined
          : Number.parseInt(tokenId.trim(), 10)

      const body: Record<string, unknown> = {
        limit: 5,
      }
      if (tag) body.intentTag = tag
      if (text) body.intent = text.slice(0, MAX_INTENT)
      if (
        parsedToken != null &&
        Number.isFinite(parsedToken) &&
        parsedToken >= 0 &&
        parsedToken <= 9999
      ) {
        body.tokenId = parsedToken
      }
      if (address) body.wallet = address

      try {
        const res = await fetch("/api/zulo/paths", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const data = (await res.json()) as RankPathsResult | { error: string }
        if (!res.ok || !("ok" in data) || !data.ok) {
          setError(
            "error" in data && typeof data.error === "string"
              ? data.error
              : "Could not rank moves",
          )
          setResult(null)
          return
        }
        setResult(data)
      } catch {
        setError("Network error ranking moves")
        setResult(null)
      } finally {
        setLoading(false)
      }
    },
    [address, intent, intentTag, tokenId],
  )

  const onChip = (tag: IntentTag) => {
    setIntentTag(tag)
    void runRank({ tag })
  }

  const paths: RankedPath[] = result?.paths ?? []

  return (
    <div className="moves-board">
      <header>
        <p className="moves-kicker mono">MOVES · ZULO CONCIERGE · FREE</p>
        <h1 className="moves-title">What are you deciding?</h1>
        <p className="moves-lede">
          High-signal Normies help for burns, trait/tool picks, and Canvas
          moves. Pick a chip or one short sentence — Zulo ranks 3–5 tryable
          moves by CredHub Pulse, access, and relevance. Burn ROI is a
          highlight, not the whole job.
        </p>
        {helpfulCount != null ? (
          <p className="moves-stats mono">
            Helpful ratings · Zulo #32626 · {helpfulCount}
          </p>
        ) : null}
      </header>

      <section className="moves-form">
        <div>
          <span className="moves-label">Pick an intent</span>
          <IntentChips
            selected={intentTag}
            onSelect={onChip}
            disabled={loading}
          />
        </div>

        <div>
          <label htmlFor="path-intent" className="moves-label">
            Or describe the job in one sentence
          </label>
          <div className="moves-row">
            <input
              id="path-intent"
              type="text"
              className="moves-input"
              maxLength={MAX_INTENT}
              value={intent}
              disabled={loading}
              placeholder="e.g. efficient burn fodder for AP"
              onChange={(e) => setIntent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  void runRank()
                }
              }}
            />
            <button
              type="button"
              className="button button-primary"
              disabled={loading}
              onClick={() => void runRank()}
            >
              {loading ? "Ranking…" : "Rank moves"}
            </button>
          </div>
        </div>

        <div className="moves-row">
          <label htmlFor="path-token" className="moves-label" style={{ marginBottom: 0 }}>
            Normie token ID (optional)
          </label>
          <input
            id="path-token"
            type="number"
            min={0}
            max={9999}
            className="moves-input moves-input-token"
            value={tokenId}
            disabled={loading}
            onChange={(e) => setTokenId(e.target.value)}
            placeholder="0–9999"
          />
          {address ? (
            <span className="mono" style={{ fontSize: 11, opacity: 0.65 }}>
              wallet {address.slice(0, 6)}…{address.slice(-4)}
            </span>
          ) : (
            <button
              type="button"
              className="caption"
              style={{ opacity: 0.85, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}
              onClick={() =>
                promptConnect("Connect your wallet to show access badges for tools and agents.")
              }
            >
              Connect wallet for access badges
            </button>
          )}
        </div>
      </section>

      {error ? (
        <p role="alert" className="moves-alert">
          {error}
        </p>
      ) : null}

      {result ? (
        <section className="moves-results">
          <p className="moves-results-meta mono">
            Intent: {result.intent.tags.join(", ")}
            {result.subject.pulse_level != null
              ? ` · subject Pulse ${result.subject.pulse_level}/5`
              : " · no Normie loaded"}
          </p>
          {paths.map((p) => (
            <PathCard
              key={p.pathId}
              path={p}
              feedbackContext={{
                intentTag: result.intent.primary,
                intentRaw: result.intent.raw || intent,
                subjectTokenId: result.subject.tokenId,
                wallet: address,
              }}
            />
          ))}
          <p className="moves-footnote">{result.zulo.note}</p>
          <p className="moves-footnote">
            Rate any move with 👍/👎 — credits the recommended tool/agent and
            Zulo #32626. {REPUTATION_NOTE}
          </p>
        </section>
      ) : !loading && !error ? (
        <div className="moves-empty">
          <p>
            Pick a chip or type one sentence. Zulo will rank the highest-signal
            moves you can try right now.
          </p>
        </div>
      ) : null}
    </div>
  )
}
