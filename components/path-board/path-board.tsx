"use client"

import { useCallback, useEffect, useState } from "react"
import { useAccount } from "wagmi"

import type { IntentTag, RankedPath, RankPathsResult } from "@/lib/path-ranker"

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
        if (!cancelled && res.ok && data.ok && typeof data.helpfulCount === "number") {
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
              : "Ranking failed",
          )
          setResult(null)
          return
        }
        setResult(data)
      } catch {
        setError("Network error ranking paths")
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
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px 48px" }}>
      <header style={{ marginBottom: 28 }}>
        <p
          className="mono"
          style={{ fontSize: 12, letterSpacing: "0.12em", opacity: 0.7 }}
        >
          PATH BOARD · ZULO CONCIERGE · FREE
        </p>
        <h1 style={{ margin: "8px 0 8px", fontSize: 28, fontWeight: 700 }}>
          What are you deciding?
        </h1>
        <p style={{ margin: 0, fontSize: 15, opacity: 0.85, maxWidth: 540 }}>
          High-signal Normies help for burns, trait/tool picks, and Canvas moves.
          Pick a chip or one short sentence — Zulo ranks 3–5 tryable paths by CredHub
          Pulse, access, and relevance. Burn ROI is a highlight, not the whole job.
        </p>
        {helpfulCount != null ? (
          <p
            className="mono"
            style={{ margin: "12px 0 0", fontSize: 12, opacity: 0.75 }}
          >
            Helpful ratings · Zulo #32626 · {helpfulCount}
          </p>
        ) : null}
      </header>

      <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <IntentChips
          selected={intentTag}
          onSelect={onChip}
          disabled={loading}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label htmlFor="path-intent" style={{ fontSize: 13, opacity: 0.8 }}>
            Or describe the job in one sentence
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              id="path-intent"
              type="text"
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
              style={{
                flex: "1 1 220px",
                fontFamily: "inherit",
                fontSize: 14,
                padding: "10px 12px",
                border: "1px solid var(--border, #1a1a1a)",
                background: "var(--bg-primary, #e5e5e5)",
              }}
            />
            <button
              type="button"
              disabled={loading}
              onClick={() => void runRank()}
              style={{
                fontFamily: "inherit",
                fontSize: 14,
                padding: "10px 16px",
                border: "1px solid var(--border, #1a1a1a)",
                background: "var(--bg-dark, #1a1a1a)",
                color: "var(--text-inverse, #e5e5e5)",
                cursor: loading ? "wait" : "pointer",
              }}
            >
              {loading ? "Ranking…" : "Rank paths"}
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <label htmlFor="path-token" style={{ fontSize: 13, opacity: 0.8 }}>
            Normie token ID (optional, improves Pulse rank)
          </label>
          <input
            id="path-token"
            type="number"
            min={0}
            max={9999}
            value={tokenId}
            disabled={loading}
            onChange={(e) => setTokenId(e.target.value)}
            placeholder="0–9999"
            style={{
              width: 100,
              fontFamily: "inherit",
              fontSize: 14,
              padding: "8px 10px",
              border: "1px solid var(--border, #1a1a1a)",
              background: "var(--bg-primary, #e5e5e5)",
            }}
          />
          {address ? (
            <span className="mono" style={{ fontSize: 11, opacity: 0.65 }}>
              wallet {address.slice(0, 6)}…{address.slice(-4)}
            </span>
          ) : (
            <span style={{ fontSize: 12, opacity: 0.65 }}>
              Connect wallet for access badges
            </span>
          )}
        </div>
      </section>

      {error ? (
        <p role="alert" style={{ marginTop: 20, color: "#7f1d1d", fontSize: 14 }}>
          {error}
        </p>
      ) : null}

      {result ? (
        <section style={{ marginTop: 32 }}>
          <p className="mono" style={{ fontSize: 12, opacity: 0.7, marginBottom: 12 }}>
            Intent: {result.intent.tags.join(", ")}
            {result.subject.pulse_level != null
              ? ` · subject Pulse ${result.subject.pulse_level}/5`
              : " · no Normie loaded"}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
          </div>
          <p style={{ marginTop: 20, fontSize: 12, opacity: 0.65 }}>
            {result.zulo.note}
          </p>
          <p style={{ marginTop: 8, fontSize: 12, opacity: 0.65, maxWidth: 560 }}>
            Rate any path with 👍/👎 — credits the recommended tool/agent and Zulo
            #32626. {REPUTATION_NOTE}
          </p>
        </section>
      ) : null}
    </div>
  )
}
