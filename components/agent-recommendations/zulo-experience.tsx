"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useAccount } from "wagmi"
import { Loader2, Send } from "lucide-react"

import { useActiveNormie } from "@/components/active-normie-provider"
import { ZuloRichText } from "@/components/agent-recommendations/zulo-rich-text"
import { ConnectWallet } from "@/components/connect-wallet"
import { ZuloChromeHeader } from "@/components/zulo-chrome-header"
import { useEnsName } from "@/hooks/use-ens-name"
import {
  MAX_SESSION_HISTORY,
  MAX_USER_QUERY_CHARS,
  ZULO_IDENTITY,
} from "@/lib/agent-recommendations/constants"
import type { ZuloResponse } from "@/lib/agent-recommendations/types"
import { cn } from "@/lib/utils"

type ChatMessage = {
  id: string
  role: "user" | "zulo"
  content: string
  structured?: ZuloResponse
  error?: string
}

/** Optional skill prompts — collapsed by default, nearly hidden. */
const QUICK_PROMPTS = [
  { label: "Analyze PULSE", prompt: "Analyze my PULSE" },
  { label: "Scan burns", prompt: "scan burns" },
  { label: "Market status", prompt: "market status" },
  { label: "Preview canvas", prompt: "preview canvas add 12 pixels" },
  { label: "Gacha odds", prompt: "gacha odds" },
  { label: "80×80 readiness", prompt: "80x80 expansion readiness" },
  { label: "Earn AP", prompt: "How do I earn more AP strategically?" },
] as const

/**
 * Concierge-style in-flight labels while POST /api/zulo/ask is pending.
 * Elapsed-time phases only — not true server stages.
 */
const ASK_STATUS_PHASES = [
  { afterMs: 0, label: "Reading your question…" },
  { afterMs: 2_000, label: "Checking saved resources…" },
  { afterMs: 4_000, label: "Using Zulo's PULSE tool…" },
  { afterMs: 7_000, label: "Asking Venice…" },
  { afterMs: 12_000, label: "Zulo is deliberating…" },
] as const

/** Timeout / 504 coaching — concise, mobile-friendly, example-led. */
const TIMEOUT_COACHING =
  "Timed out waiting for the model. Try a more concise or specific question — e.g. which should I hold or burn #1234 or #5678? pixel count + dual-eval."

function statusLabelForElapsed(elapsedMs: number): string {
  let label: string = ASK_STATUS_PHASES[0].label
  for (const phase of ASK_STATUS_PHASES) {
    if (elapsedMs >= phase.afterMs) label = phase.label
  }
  return label
}

function formatZuloReplyForHistory(response: ZuloResponse): string {
  const rec = Array.isArray(response.recommendation)
    ? response.recommendation.join(" · ")
    : response.recommendation
  const sources =
    response.sources && response.sources.length
      ? `\nSources: ${response.sources.join(" · ")}`
      : ""
  return `${response.understanding}\n${rec}\n${response.reasoning}${sources}`
}

export function ZuloExperience({
  defaultTokenId: _defaultTokenId = ZULO_IDENTITY.tokenId,
}: {
  /** @deprecated Showcase default only — Ask no longer injects this as user subject when disconnected. */
  defaultTokenId?: number
}) {
  const { address } = useAccount()
  const { data: ensName } = useEnsName(address)
  const { activeTokenId, hasWallet } = useActiveNormie()

  /** Only scope Ask to Active Normie when wallet is connected. */
  const scopedTokenId =
    hasWallet && activeTokenId != null ? activeTokenId : undefined
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  /** Elapsed-time concierge label while ask is in flight; cleared on settle. */
  const [askStatus, setAskStatus] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const skillsDetailsRef = useRef<HTMLDetailsElement>(null)
  const welcomeSent = useRef(false)

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      })
    })
  }, [])

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)")
    const apply = () => setIsMobile(mq.matches)
    apply()
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [])

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const handle = () => {
      setKeyboardOpen(vv.height < window.innerHeight * 0.75)
    }
    handle()
    vv.addEventListener("resize", handle)
    return () => vv.removeEventListener("resize", handle)
  }, [])

  useEffect(() => {
    if (welcomeSent.current) return
    welcomeSent.current = true
    setMessages([
      {
        id: "welcome",
        role: "zulo",
        content:
          "I am Zulo. Ask about burns, Canvas, PULSE, or any Normie by token ID — free, no wallet required. Connect to scope advice to your Active Normie. What are we deciding?",
      },
    ])
  }, [])

  useEffect(() => {
    if (messages.length > 1 || loading) scrollToBottom()
  }, [messages, loading, scrollToBottom])

  // Rotate calm monochrome status by elapsed time while ask is in flight.
  // Text-only updates (no spinner/bar); works with prefers-reduced-motion.
  useEffect(() => {
    if (!loading) {
      setAskStatus(null)
      return
    }
    const started = Date.now()
    const tick = () => setAskStatus(statusLabelForElapsed(Date.now() - started))
    tick()
    const id = window.setInterval(tick, 400)
    return () => window.clearInterval(id)
  }, [loading])

  async function sendMessage(raw?: string) {
    const userQuery = (raw ?? input).trim()
    if (!userQuery || loading) return
    if (userQuery.length > MAX_USER_QUERY_CHARS) return

    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: userQuery },
    ])
    setInput("")
    setLoading(true)
    setAskStatus(statusLabelForElapsed(0))
    // Keep optional Skills tray collapsed after a prompt fires
    if (skillsDetailsRef.current) {
      skillsDetailsRef.current.open = false
    }

    const sessionHistory = messages
      .filter((m) => m.role === "user" || m.structured)
      .reduce<Array<{ userMessage: string; zuloResponse: string }>>(
        (acc, m, i, arr) => {
          if (m.role !== "user") return acc
          const next = arr[i + 1]
          if (next?.role === "zulo" && next.structured) {
            acc.push({
              userMessage: m.content,
              zuloResponse: formatZuloReplyForHistory(next.structured),
            })
          }
          return acc
        },
        [],
      )
      .slice(-MAX_SESSION_HISTORY)

    try {
      const res = await fetch("/api/zulo/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userQuery,
          // Only pass Active Normie when wallet is connected — never fake #7141 as visitor subject
          ...(scopedTokenId != null ? { normieId: scopedTokenId } : {}),
          sessionHistory,
          userWallet: address,
          userEns: ensName || undefined,
          service: "holder-chat",
        }),
      })

      const data = (await res.json().catch(() => ({}))) as ZuloResponse & {
        error?: string
      }

      if (!res.ok) {
        const retryable =
          (data as { retryable?: boolean }).retryable === true ||
          res.status === 502 ||
          res.status === 504
        const isTimeout =
          res.status === 504 ||
          (data as { code?: string }).code === "timeout"
        const errText =
          isTimeout
            ? // Prefer shared coaching; rewrite legacy “shorter question” payloads too
              data.error &&
              !/shorter question/i.test(data.error)
                ? data.error
                : TIMEOUT_COACHING
            : data.error ||
              (res.status === 502
                ? "Model upstream is degraded. Strategy skills may still load on retry."
                : `Something went wrong (${res.status}). Please try again.`)
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "zulo",
            content: retryable ? `${errText}` : errText,
            error: data.error || String(res.status),
          },
        ])
        return
      }

      const structured: ZuloResponse = {
        understanding: data.understanding || "I received your request.",
        recommendation:
          data.recommendation ?? "No specific recommendation available.",
        reasoning: data.reasoning || "Based on current context.",
        nextSteps: Array.isArray(data.nextSteps) ? data.nextSteps : [],
        confidence: data.confidence,
        sources: Array.isArray(data.sources) ? data.sources : [],
      }

      const content = Array.isArray(structured.recommendation)
        ? structured.recommendation.join("\n")
        : structured.recommendation

      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "zulo", content, structured },
      ])
    } catch (err) {
      const aborted =
        err instanceof DOMException
          ? err.name === "AbortError"
          : err instanceof Error && /abort|timeout/i.test(err.message)
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "zulo",
          content: aborted
            ? TIMEOUT_COACHING
            : "I apologize — the connection faltered. Please try again.",
          error: aborted ? "timeout" : "network",
        },
      ])
    } finally {
      setLoading(false)
      setAskStatus(null)
    }
  }

  const canSend =
    !loading && input.trim().length > 0 && input.length <= MAX_USER_QUERY_CHARS

  return (
    <div
      className={cn(
        "zulo-chrome ask-shell ask-sparse",
        isMobile && "is-mobile",
        keyboardOpen && "keyboard-open",
      )}
    >
      <div className="ask-top">
        <ZuloChromeHeader
          active="ask"
          fixed={false}
          trailing={
            <span style={{ display: "inline-flex", alignItems: "center" }}>
              <ConnectWallet />
            </span>
          }
        />
      </div>

      <p className="ask-context-line" data-reveal>
        {scopedTokenId != null ? (
          <>
            High-signal help · scoped to active Normie · on-chain PULSE &amp;
            Canvas — not generic chat
            <span className="ask-context-id mono"> · #{scopedTokenId}</span>
          </>
        ) : (
          <>
            High-signal help · on-chain Normies data — not generic chat · connect
            wallet to scope to your Normie
          </>
        )}
      </p>

      <main className="ask-main">
        <div className="ask-chat">
          <div className="chat-messages">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "chat-message",
                  msg.role === "user"
                    ? "chat-message-user"
                    : "chat-message-zulo",
                )}
              >
                {msg.role === "zulo" && !isMobile ? (
                  <div className="chat-avatar">Z</div>
                ) : null}
                <div className="chat-stack">
                  {/* Structured replies: hierarchy lives in the card (no duplicate wall of text) */}
                  {msg.structured && msg.role === "zulo" ? (
                    <StructuredCard
                      response={msg.structured}
                      compact={isMobile}
                    />
                  ) : (
                    <div
                      className={cn(
                        "chat-bubble",
                        msg.error && "chat-bubble-error",
                      )}
                    >
                      {msg.role === "zulo" ? (
                        <ZuloRichText text={msg.content} />
                      ) : (
                        msg.content
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && askStatus ? (
              <div
                className="chat-message chat-message-zulo"
                aria-live="polite"
                aria-atomic="true"
              >
                {!isMobile ? <div className="chat-avatar">Z</div> : null}
                <div className="chat-stack">
                  <div
                    className="chat-bubble ask-inflight-status"
                    // Calm monochrome status only — no spinner, bar, or color theater
                  >
                    {askStatus}
                  </div>
                </div>
              </div>
            ) : null}

            <div ref={messagesEndRef} />
          </div>

          <div className={cn("chat-footer", keyboardOpen && "pb-safe")}>
            {/* Input first — always visible; skills stay collapsed unless user opens them */}
            <div className="chat-input">
              <input
                type="text"
                className="chat-input-field"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    if (canSend) void sendMessage()
                  }
                }}
                placeholder={isMobile ? "Ask…" : "Ask Zulo…"}
                maxLength={MAX_USER_QUERY_CHARS}
                disabled={loading}
              />
              <button
                type="button"
                className="button button-primary"
                disabled={!canSend}
                onClick={() => void sendMessage()}
                aria-label="Send"
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : isMobile ? (
                  "→"
                ) : (
                  <>
                    <Send className="size-4" />
                    Ask
                  </>
                )}
              </button>
            </div>

            {!keyboardOpen ? (
              <details
                ref={skillsDetailsRef}
                className="ask-skills-details"
                // Uncontrolled — never set open; browser default is collapsed
              >
                <summary className="ask-skills-summary">Skills</summary>
                <div
                  className={cn(
                    "quick-prompts",
                    isMobile && "scrollbar-hide quick-prompts-scroll",
                  )}
                >
                  {QUICK_PROMPTS.map((item) => (
                    <button
                      key={item.prompt}
                      type="button"
                      className="quick-prompt"
                      disabled={loading}
                      title={item.prompt}
                      onClick={() => void sendMessage(item.prompt)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        </div>
      </main>

      {!keyboardOpen ? (
        <p className="dyor">
          Informational only — DYOR. Burns are permanent. Zulo never asks for
          keys.
        </p>
      ) : null}
    </div>
  )
}

function StructuredCard({
  response,
  compact = false,
}: {
  response: ZuloResponse
  compact?: boolean
}) {
  const confidence =
    typeof response.confidence === "number" && Number.isFinite(response.confidence)
      ? Math.max(0, Math.min(100, Math.round(response.confidence)))
      : 70

  const recs = Array.isArray(response.recommendation)
    ? response.recommendation
    : [response.recommendation]

  const sources = (response.sources ?? []).filter(
    (s): s is string => typeof s === "string" && s.trim().length > 0,
  )

  const understanding = response.understanding?.trim() ?? ""
  const pulseLead = response.pulseLead?.trim() ?? ""
  const understandingWithoutLead =
    pulseLead && understanding.startsWith(pulseLead)
      ? understanding.slice(pulseLead.length).trim()
      : understanding

  return (
    <div className={cn("response-block", compact && "response-block-compact")}>
      {pulseLead ? (
        <div className="response-section response-pulse-lead">
          <p className="response-label">Pulse</p>
          <p className="response-pulse-text">{pulseLead}</p>
        </div>
      ) : null}

      {!compact && understandingWithoutLead ? (
        <div className="response-section">
          <p className="response-label">Understanding</p>
          <ZuloRichText text={understandingWithoutLead} />
        </div>
      ) : null}

      <div className="response-section response-section-primary">
        <p className="response-label">Recommendation</p>
        {recs.length === 1 ? (
          <ZuloRichText text={recs[0] ?? ""} emphasis />
        ) : (
          <ul className="zulo-rich-list response-rec-list">
            {recs.map((rec, i) => (
              <li key={i}>
                <ZuloRichText text={rec} emphasis />
              </li>
            ))}
          </ul>
        )}
      </div>

      {!compact && response.reasoning ? (
        <div className="response-section">
          <p className="response-label">Reasoning</p>
          <ZuloRichText text={response.reasoning} />
        </div>
      ) : null}

      {response.nextSteps && response.nextSteps.length > 0 ? (
        <div className="response-section">
          <p className="response-label">Next steps</p>
          <ul className="zulo-rich-list">
            {response.nextSteps.map((step, i) => (
              <li key={i}>
                <ZuloRichText text={step} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="response-meta mono">
        <span>Confidence {confidence}%</span>
        {sources.length > 0 ? (
          <ul className="response-sources">
            {sources.slice(0, 4).map((src, i) => {
              const href =
                /^https?:\/\//i.test(src.trim()) ? src.trim() : null
              return (
                <li key={i}>
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="zulo-rich-link"
                    >
                      {src.replace(/^https?:\/\//i, "").replace(/\/$/, "")}
                    </a>
                  ) : (
                    src
                  )}
                </li>
              )
            })}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
