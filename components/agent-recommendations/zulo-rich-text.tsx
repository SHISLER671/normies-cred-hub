"use client"

import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * Light, safe markdown for Zulo chat:
 * - **bold**, *italic*
 * - bullet lists (- / * / •)
 * - blank-line paragraphs
 * - [label](https://…) and bare https URLs
 * No HTML, no raw markup injection.
 */

function sanitizeHref(href: string): string | null {
  try {
    const u = new URL(href)
    if (u.protocol !== "http:" && u.protocol !== "https:") return null
    return u.toString()
  } catch {
    return null
  }
}

function prettyUrlLabel(href: string): string {
  try {
    const u = new URL(href)
    const path = u.pathname === "/" ? "" : u.pathname
    const hostPath = `${u.host}${path}`
    return hostPath.length > 48 ? `${hostPath.slice(0, 45)}…` : hostPath
  } catch {
    return href
  }
}

/** **bold** and *italic* (bold first). */
function renderInlineEmphasis(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*)/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      nodes.push(text.slice(last, m.index))
    }
    if (m[2] != null) {
      nodes.push(
        <strong key={`${keyPrefix}-b${i}`} className="zulo-rich-strong">
          {m[2]}
        </strong>,
      )
    } else if (m[3] != null) {
      nodes.push(
        <em key={`${keyPrefix}-i${i}`} className="zulo-rich-em">
          {m[3]}
        </em>,
      )
    }
    last = m.index + m[0].length
    i++
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes.length ? nodes : [text]
}

type InlineTok =
  | { type: "text"; value: string }
  | { type: "link"; href: string; label: string }

/** Extract markdown links and bare https URLs, left-to-right. */
function tokenizeLinks(text: string): InlineTok[] {
  const combined =
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|https?:\/\/[^\s<>[\](){}|"']+/gi
  const tokens: InlineTok[] = []
  let last = 0
  let m: RegExpExecArray | null
  while ((m = combined.exec(text)) !== null) {
    if (m.index > last) {
      tokens.push({ type: "text", value: text.slice(last, m.index) })
    }
    if (m[1] != null && m[2] != null) {
      tokens.push({ type: "link", href: m[2], label: m[1] })
    } else {
      tokens.push({ type: "link", href: m[0], label: prettyUrlLabel(m[0]) })
    }
    last = m.index + m[0].length
  }
  if (last < text.length) {
    tokens.push({ type: "text", value: text.slice(last) })
  }
  return tokens.length ? tokens : [{ type: "text", value: text }]
}

function linkifyText(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  tokenizeLinks(text).forEach((tok, i) => {
    const k = `${keyPrefix}-t${i}`
    if (tok.type === "text") {
      nodes.push(...renderInlineEmphasis(tok.value, k))
      return
    }
    const href = sanitizeHref(tok.href)
    if (!href) {
      nodes.push(...renderInlineEmphasis(tok.label, k))
      return
    }
    nodes.push(
      <a
        key={k}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="zulo-rich-link"
      >
        {tok.label}
      </a>,
    )
  })
  return nodes
}

function isBulletLine(line: string): boolean {
  return /^\s*[-*•]\s+/.test(line)
}

function stripBullet(line: string): string {
  return line.replace(/^\s*[-*•]\s+/, "")
}

type Block =
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "h"; text: string }

/**
 * Split into paragraphs / lists. A line that is only **Label** becomes a section head.
 */
function parseBlocks(raw: string): Block[] {
  const text = raw.replace(/\r\n/g, "\n").trim()
  if (!text) return []

  const lines = text.split("\n")
  const blocks: Block[] = []
  let para: string[] = []
  let list: string[] | null = null

  const flushPara = () => {
    if (!para.length) return
    const joined = para.join("\n").trim()
    if (joined) blocks.push({ type: "p", text: joined })
    para = []
  }

  const flushList = () => {
    if (list?.length) blocks.push({ type: "ul", items: list })
    list = null
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      flushPara()
      flushList()
      continue
    }

    // Section label: **Floor snapshot** alone on a line (optional trailing colon)
    const sectionOnly = trimmed.match(/^\*\*([^*]+)\*\*:?\s*$/)
    if (sectionOnly) {
      flushPara()
      flushList()
      blocks.push({ type: "h", text: sectionOnly[1].trim() })
      continue
    }

    if (isBulletLine(line)) {
      flushPara()
      if (!list) list = []
      list.push(stripBullet(line))
      continue
    }

    flushList()
    para.push(line)
  }
  flushPara()
  flushList()
  return blocks
}

export function ZuloRichText({
  text,
  className,
  emphasis = false,
}: {
  text: string
  className?: string
  /** Slightly stronger body (recommendation body) */
  emphasis?: boolean
}) {
  if (!text?.trim()) return null

  const blocks = parseBlocks(text)

  return (
    <div
      className={cn(
        "zulo-rich-text",
        emphasis && "zulo-rich-text-emphasis",
        className,
      )}
    >
      {blocks.map((block, i) => {
        if (block.type === "h") {
          return (
            <p key={`h-${i}`} className="zulo-rich-section">
              <strong className="zulo-rich-strong">{block.text}</strong>
            </p>
          )
        }
        if (block.type === "ul") {
          return (
            <ul key={`ul-${i}`} className="zulo-rich-list">
              {block.items.map((item, j) => (
                <li key={`li-${i}-${j}`}>{linkifyText(item, `l${i}-${j}`)}</li>
              ))}
            </ul>
          )
        }
        const parts = block.text.split("\n")
        return (
          <p key={`p-${i}`} className="zulo-rich-p">
            {parts.map((part, j) => (
              <span key={`ps-${i}-${j}`}>
                {j > 0 ? <br /> : null}
                {linkifyText(part, `p${i}-${j}`)}
              </span>
            ))}
          </p>
        )
      })}
    </div>
  )
}
