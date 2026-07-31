"use client"

import type { RankedPath } from "@/lib/path-ranker"

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

export function PathCard({ path }: { path: RankedPath }) {
  const step = path.nextStep
  const href = step.href || step.endpoint

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
            {path.publisher.name}
            {path.publisher.agentId != null
              ? ` · Agent #${path.publisher.agentId}`
              : ""}
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
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

      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{path.rationale}</p>

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
            {step.label} →
          </a>
        ) : (
          <span style={{ fontSize: 13, fontWeight: 600 }}>{step.label}</span>
        )}
      </div>
    </article>
  )
}
