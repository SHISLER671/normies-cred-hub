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
          "this path"
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

  const btnBase = {
    fontFamily: "inherit",
    fontSize: 13,
    padding: "6px 12px",
    border: "1px solid var(--border, #1a1a1a)",
    background: "var(--bg-primary, #e5e5e5)",
    color: "var(--foreground, #1a1a1a)",
    cursor: pending || submitted ? ("default" as const) : ("pointer" as const),
    opacity: pending ? 0.6 : 1,
  }

  return (
    <article
      className="path-card"
      style={{
        border: "1px solid var(--border, #1a1a1a)",
        padding: "16px 18px",
        background: "var(--bg-secondary, #d4d4d4)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            className="mono"
            style={{ fontSize: 12, letterSpacing: "0.08em", opacity: 0.7 }}
          >
            #{path.rank} · {path.kind}
          </div>
          <h3 style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 700 }}>
            {path.title}
          </h3>
          <p style={{ margin: "4px 0 0", fontSize: 13, opacity: 0.8 }}>
            Recommended tool / agent · {path.publisher.name}
            {path.publisher.agentId != null
              ? ` · Agent #${path.publisher.agentId}`
              : ""}
          </p>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            alignItems: "flex-end",
          }}
        >
          <span
            style={{
              fontSize: 11,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              border: "1px solid var(--border, #1a1a1a)",
              padding: "3px 8px",
              background: "var(--bg-primary, #e5e5e5)",
            }}
          >
            {path.pulse.badge}
          </span>
          <span
            style={{
              fontSize: 11,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              border: "1px solid var(--border, #1a1a1a)",
              padding: "3px 8px",
            }}
            title={path.access.note}
          >
            {accessLabel(path.access.status)}
          </span>
        </div>
      </div>

      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
        <span style={{ fontWeight: 600 }}>Why: </span>
        {path.rationale}
      </p>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginTop: 4,
        }}
      >
        <span className="mono" style={{ fontSize: 11, opacity: 0.65 }}>
          score {path.score.total.toFixed(2)} · P{path.score.pulse.toFixed(2)} A
          {path.score.access.toFixed(2)} R{path.score.relevance.toFixed(2)}
        </span>
        {href ? (
          <a
            href={href}
            target={href.startsWith("http") ? "_blank" : undefined}
            rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
            className="button button-primary"
            style={{
              display: "inline-block",
              padding: "8px 14px",
              fontSize: 13,
              textDecoration: "none",
              border: "1px solid var(--border, #1a1a1a)",
              background: "var(--bg-dark, #1a1a1a)",
              color: "var(--text-inverse, #e5e5e5)",
            }}
          >
            Try: {step.label} →
          </a>
        ) : (
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            Try: {step.label}
          </span>
        )}
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 10,
          marginTop: 4,
          paddingTop: 10,
          borderTop: "1px solid var(--border, #1a1a1a)",
        }}
      >
        <span style={{ fontSize: 13, opacity: 0.85 }}>Helpful?</span>
        <button
          type="button"
          aria-label="Helpful"
          disabled={pending || submitted != null}
          onClick={() => void rate("up")}
          style={{
            ...btnBase,
            background:
              submitted === "up"
                ? "var(--bg-dark, #1a1a1a)"
                : "var(--bg-primary, #e5e5e5)",
            color:
              submitted === "up"
                ? "var(--text-inverse, #e5e5e5)"
                : "var(--foreground, #1a1a1a)",
          }}
        >
          👍
        </button>
        <button
          type="button"
          aria-label="Not helpful"
          disabled={pending || submitted != null}
          onClick={() => void rate("down")}
          style={{
            ...btnBase,
            background:
              submitted === "down"
                ? "var(--bg-dark, #1a1a1a)"
                : "var(--bg-primary, #e5e5e5)",
            color:
              submitted === "down"
                ? "var(--text-inverse, #e5e5e5)"
                : "var(--foreground, #1a1a1a)",
          }}
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
