"use client"

import { useCallback, useState } from "react"

import type { IntentTag, RankedPath } from "@/lib/path-ranker"

function accessLabel(status: RankedPath["access"]["status"]): string {
  switch (status) {
    case "open":
      return "Open"
    case "granted":
      return "You can use"
    case "gated":
      return "Gated"
    case "unknown":
      return "Not checked"
    case "n/a":
      return "N/A"
    default:
      return status
  }
}

export type PathCardFeedbackContext = {
  intentTag?: IntentTag
  intentRaw?: string
  subjectTokenId?: number | null
  wallet?: string
}

export function PathCard({
  path,
  feedbackContext,
}: {
  path: RankedPath
  feedbackContext?: PathCardFeedbackContext
}) {
  const step = path.nextStep
  const href = step.href || step.endpoint

  const [pending, setPending] = useState(false)
  const [submitted, setSubmitted] = useState<"up" | "down" | null>(null)
  const [thanks, setThanks] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const rate = useCallback(
    async (rating: "up" | "down") => {
      if (pending || submitted) return
      setPending(true)
      setErr(null)
      try {
        const body: Record<string, unknown> = {
          rating,
          pathId: path.pathId,
          pathKind: path.kind,
          pathTitle: path.title,
          context: "path-board",
        }
        if (path.publisher.name) body.publisherName = path.publisher.name
        if (path.publisher.agentId != null) {
          body.publisherAgentId = path.publisher.agentId
        }
        if (path.publisher.tokenId != null) {
          body.publisherTokenId = path.publisher.tokenId
        }
        if (feedbackContext?.intentTag) body.intentTag = feedbackContext.intentTag
        if (feedbackContext?.intentRaw) {
          body.intentRaw = feedbackContext.intentRaw.slice(0, 200)
        }
        if (
          feedbackContext?.subjectTokenId != null &&
          Number.isFinite(feedbackContext.subjectTokenId)
        ) {
          body.subjectTokenId = feedbackContext.subjectTokenId
        }
        if (feedbackContext?.wallet) body.wallet = feedbackContext.wallet

        const res = await fetch("/api/zulo/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const data = (await res.json()) as {
          ok?: boolean
          error?: string
          credited?: { publisherName?: string | null }
        }
        if (!res.ok || !data.ok) {
          setErr(data.error ?? "Could not save rating")
          return
        }
        setSubmitted(rating)
        const pub =
          data.credited?.publisherName?.trim() ||
          path.publisher.name ||
          "this move"
        setThanks(
          rating === "up"
            ? `Thanks — credited to ${pub} + Zulo #32626`
            : "Thanks — noted for Zulo",
        )
      } catch {
        setErr("Network error saving rating")
      } finally {
        setPending(false)
      }
    },
    [feedbackContext, path, pending, submitted],
  )

  return (
    <article className="move-card path-card">
      <div className="move-card-top">
        <div>
          <div className="move-card-rank mono">
            #{path.rank} · {path.kind}
          </div>
          <h3 className="move-card-title">{path.title}</h3>
          <p className="move-card-publisher">
            Recommended tool / agent · {path.publisher.name}
            {path.publisher.agentId != null
              ? ` · Agent #${path.publisher.agentId}`
              : ""}
          </p>
        </div>
        <div className="move-card-badges">
          <span className="badge">{path.pulse.badge}</span>
          <span className="badge" title={path.access.note}>
            {accessLabel(path.access.status)}
          </span>
        </div>
      </div>

      <p className="move-card-why">
        <strong>Why: </strong>
        {path.rationale}
      </p>

      <div className="move-card-actions">
        <span className="move-card-score mono">
          score {path.score.total.toFixed(2)} · P{path.score.pulse.toFixed(2)} A
          {path.score.access.toFixed(2)} R{path.score.relevance.toFixed(2)}
        </span>
        {href ? (
          <a
            href={href}
            target={href.startsWith("http") ? "_blank" : undefined}
            rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
            className="button button-primary button-sm"
          >
            Try: {step.label} →
          </a>
        ) : (
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            Try: {step.label}
          </span>
        )}
      </div>

      <div className="move-card-rate">
        <span style={{ fontSize: 13, opacity: 0.85 }}>Helpful?</span>
        <button
          type="button"
          aria-label="Helpful"
          disabled={pending || submitted != null}
          onClick={() => void rate("up")}
          className={
            submitted === "up"
              ? "move-rate-btn is-selected"
              : "move-rate-btn"
          }
          style={{ opacity: pending ? 0.6 : 1 }}
        >
          👍
        </button>
        <button
          type="button"
          aria-label="Not helpful"
          disabled={pending || submitted != null}
          onClick={() => void rate("down")}
          className={
            submitted === "down"
              ? "move-rate-btn is-selected"
              : "move-rate-btn"
          }
          style={{ opacity: pending ? 0.6 : 1 }}
        >
          👎
        </button>
        {thanks ? (
          <span style={{ fontSize: 12, opacity: 0.8 }}>{thanks}</span>
        ) : null}
        {err ? (
          <span role="alert" style={{ fontSize: 12, opacity: 0.9 }}>
            {err}
          </span>
        ) : null}
      </div>
    </article>
  )
}
