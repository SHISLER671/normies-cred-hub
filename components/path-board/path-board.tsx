"use client"

import { useCallback, useEffect, useState } from "react"
import { useAccount } from "wagmi"

import { useActiveNormie } from "@/components/active-normie-provider"
import { ActiveNormieBadge } from "@/components/active-normie-switcher"
import type { IntentTag, RankedPath, RankPathsResult } from "@/lib/path-ranker"
import { useWalletGate } from "@/components/wallet-gate"

import { IntentChips } from "./intent-chips"
import { PathCard } from "./path-card"

const MAX_INTENT = 200

export function PathBoard({
  defaultTokenId,
}: {
  defaultTokenId?: number
}) {
  const { address } = useAccount()
  const { promptConnect } = useWalletGate()
  const { activeTokenId } = useActiveNormie()
  const subjectTokenId = activeTokenId ?? defaultTokenId

  const [intentTag, setIntentTag] = useState<IntentTag | null>(null)
  const [intent, setIntent] = useState("")
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
        setError("Pick a chip or type one sentence.")
        return
      }

      setLoading(true)
      setError(null)

      const body: Record<string, unknown> = {
        limit: 5,
      }
      if (tag) body.intentTag = tag
      if (text) body.intent = text.slice(0, MAX_INTENT)
      if (
        subjectTokenId != null &&
        Number.isFinite(subjectTokenId) &&
        subjectTokenId >= 0 &&
        subjectTokenId <= 9999
      ) {
        body.tokenId = subjectTokenId
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
    [address, intent, intentTag, subjectTokenId],
  )

  const onChip = (tag: IntentTag) => {
    setIntentTag(tag)
    void runRank({ tag })
  }

  const paths: RankedPath[] = result?.paths ?? []
  const showIdleHint = !result && !loading && !error

  return (
    <div className="moves-board">
      <header className="moves-header" data-reveal>
        <p className="moves-kicker mono">MOVES · FREE</p>
        <ActiveNormieBadge />
        <h1 className="moves-title">
          Zulo helps agents and humans find tools.
          <br />
          What do you need a tool for today?
        </h1>
        <p className="moves-lede">
          Pick an intent or one sentence. Zulo ranks 3–5 tryable moves for the
          active Normie.
        </p>
        {helpfulCount != null ? (
          <p className="moves-stats mono">
            Helpful · Zulo #32626 · {helpfulCount}
          </p>
        ) : null}
      </header>

      <section className="moves-form" data-reveal>
        <div className="moves-intents-block">
          <span className="moves-label">Intent</span>
          <IntentChips
            selected={intentTag}
            onSelect={onChip}
            disabled={loading}
          />
          {showIdleHint ? (
            <p className="moves-idle-hint">
              Choose a chip or type a sentence to rank moves.
            </p>
          ) : null}
        </div>

        <div className="moves-primary">
          <label htmlFor="path-intent" className="moves-label">
            Or describe the job
          </label>
          <div className="moves-row moves-row-primary">
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
              className="button button-primary moves-rank-btn"
              disabled={loading}
              onClick={() => void runRank()}
            >
              {loading ? "Ranking…" : "Rank moves"}
            </button>
          </div>
          {!address ? (
            <p className="moves-wallet-hint">
              <button
                type="button"
                className="moves-wallet-link"
                onClick={() =>
                  promptConnect(
                    "Connect your wallet to show access badges for tools and agents.",
                  )
                }
              >
                Connect wallet
              </button>{" "}
              for access badges · subject is Active Normie in the header
            </p>
          ) : null}
        </div>
      </section>

      {error ? (
        <p role="alert" className="moves-alert">
          {error}
        </p>
      ) : null}

      {result ? (
        <section className="moves-results" data-reveal>
          <p className="moves-results-meta mono">
            {result.intent.tags.join(" · ")}
            {result.subject.tokenId != null
              ? ` · #${result.subject.tokenId}`
              : ""}
            {result.subject.pulse_level != null
              ? ` · Pulse ${result.subject.pulse_level}/5`
              : ""}
          </p>
          <div className="moves-results-list">
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
          <p className="moves-footnote">
            Rate any move 👍/👎 — credits the tool/agent and Zulo #32626.
            Ratings build trackable CredHub reputation today; on-chain tips when
            rails enable.
          </p>
          <p className="moves-disclaimer">
            We do not endorse these tools. We are building a system so the
            useful ones can stand out.
          </p>
        </section>
      ) : null}
    </div>
  )
}
