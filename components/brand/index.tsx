// Brand v2 building blocks (2026-10-09): the normies.art cell system, built once for every NCH page.
// Styles live in app/brand.css (ink/paper tokens, square corners, 1px hairlines, tracked uppercase labels).
// NCH's own LIVE chips use Zulo cyan; that accent is what keeps NCH visibly independent of the official site.

import Link from "next/link"

import { cn } from "@/lib/utils"

type ChipTone = "live" | "ours" | "outline"

/** A status chip: `live` is paper-filled with a square bullet, `ours` is the same in Zulo cyan, `outline` is a hairline. */
export function Chip({ tone = "outline", children, className }: { tone?: ChipTone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("nb-chip", `nb-chip-${tone}`, className)}>
      {tone !== "outline" && <span className="nb-chip-dot" aria-hidden="true" />}
      {children}
    </span>
  )
}

/** A tracked uppercase label above a section, with an optional number ("01") and the left bar. */
export function Eyebrow({ n, children, className }: { n?: string; children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("nb-eyebrow", className)}>
      {n && <span className="nb-eyebrow-n">{n}</span>}
      {children}
    </p>
  )
}

/** Cells that share 1px hairlines, like the cards on normies.art/lab. Columns fill the width. */
export function CellGrid({ children, className, label }: { children: React.ReactNode; className?: string; label?: string }) {
  return (
    <div className={cn("nb-cells", className)} role="list" aria-label={label}>
      {children}
    </div>
  )
}

/** One cell: number top-left, chip top-right, title, text, and a quiet call to action. A link when `href` is set. */
export function Cell({
  n,
  chip,
  title,
  children,
  href,
  cta,
  external,
}: {
  n?: string
  chip?: React.ReactNode
  title: React.ReactNode
  children?: React.ReactNode
  href?: string
  cta?: string
  external?: boolean
}) {
  const body = (
    <>
      {(n || chip) && (
        <span className="nb-cell-top">
          <span className="nb-cell-n">{n}</span>
          {chip}
        </span>
      )}
      <span className="nb-cell-title">{title}</span>
      {children && <span className="nb-cell-text">{children}</span>}
      {cta && <span className="nb-cell-cta" aria-hidden="true">{cta}</span>}
    </>
  )
  if (!href) return <div className="nb-cell" role="listitem">{body}</div>
  if (external)
    return (
      <a className="nb-cell nb-cell-link" role="listitem" href={href} target="_blank" rel="noopener noreferrer">
        {body}
      </a>
    )
  return (
    <Link className="nb-cell nb-cell-link" role="listitem" href={href}>
      {body}
    </Link>
  )
}

/** Ruled stat cells: a small tracked label over a big number. `highlight` inverts one cell, as on the Holder Card. */
export function StatGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <dl className={cn("nb-stats", className)}>{children}</dl>
}

export function Stat({ label, value, note, highlight }: { label: React.ReactNode; value: React.ReactNode; note?: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={cn("nb-stat", highlight && "nb-stat-hi")}>
      <dt className="nb-stat-label">{label}</dt>
      <dd className="nb-stat-value">{value}</dd>
      {note && <dd className="nb-stat-note">{note}</dd>}
    </div>
  )
}
