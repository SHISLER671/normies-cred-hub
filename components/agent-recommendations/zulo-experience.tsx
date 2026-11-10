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
import { isPlaceholderText } from "@/lib/agent-recommendations/postProcess"
import type { ZuloResponse } from "@/lib/agent-recommendations/types"
import { cn } from "@/lib/utils"
import { trustedHref } from "@/lib/zulo/link-policy"

type ChatMessage = {
  id: string
  role: "user" | "zulo"
  content: string
  structured?: ZuloResponse
  error?: string
}

/** Optional skill prompts — collapsed by default, nearly hidden. */
const QUICK_PROMPTS = [
  { label: "#PIXEL if every Normie burned", prompt: "How much #PIXEL would exist if every Normie was burned?" },
  { label: "How burning works", prompt: "How does burning a Normie work, step by step, and what do I get?" },
  { label: "Check a Normie", prompt: "Tell me about Normie #7141: pixels, level, and can I trust its agent?" },
  { label: "Market status", prompt: "market status" },
  { label: "Raise my Level", prompt: "How do I raise my Normie's Level?" },
  // Score formula only: no ETH, payout or simulator figures (GrokBot review of #156).
  { label: "How revenue share is scored", prompt: "How is the Pixel Market revenue-share score calculated? Just the formula, no earnings estimates." },
] as const

/**
 * Concierge-style in-flight labels while POST /api/zulo/ask is pending.
 * Elapsed-time phases only — not true server stages.
 */
const ASK_STATUS_PHASES = [
  { afterMs: 0, label: "Reading your question…" },
  { afterMs: 2_000, label: "Pulling live Normies data…" },
  { afterMs: 6_000, label: "Doing the math…" },
  { afterMs: 12_000, label: "Writing it up…" },
  { afterMs: 25_000, label: "Still on it, thanks for your patience…" },
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
  return [response.understanding, rec, response.reasoning]
    .filter((t) => !isPlaceholderText(t))
    .join("\n")
    .concat(sources)
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
          "I am Zulo. Ask me anything about Normies: burns and #PIXEL math, Canvas, the Pixel Market, or any Normie by its number (try #7141). Free, no wallet needed. Connect a wallet and I'll talk about your Normie. What shall we work out?",
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
        understanding: data.understanding || "",
        recommendation: data.recommendation ?? "",
        reasoning: data.reasoning || "",
        nextSteps: Array.isArray(data.nextSteps) ? data.nextSteps : [],
        confidence: data.confidence,
        sources: Array.isArray(data.sources) ? data.sources : [],
        pulseLead: typeof data.pulseLead === "string" ? data.pulseLead : undefined,
        followUps: Array.isArray(data.followUps)
          ? data.followUps.filter((f): f is string => typeof f === "string" && f.trim().length > 0).slice(0, 3)
          : [],
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
        <h1 className="sr-only">Ask Zulo</h1>
        <div className="ask-chat">
          <div className="chat-messages" role="log" aria-live="polite" aria-label="Conversation with Zulo">
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
                      onFollowUp={
                        // Only the latest reply offers follow-ups, so old chips can't fire out of context.
                        msg.id === messages[messages.length - 1]?.id && !loading
                          ? (q) => void sendMessage(q)
                          : undefined
                      }
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
                aria-label="Ask Zulo"
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

/**
 * One reply, read top to bottom: the answer, then (only if trust was part of the question) a Pulse line, then sources
 * and tappable follow-ups. Same on phone and desktop: nothing is hidden on mobile any more (it used to cut answers off).
 * Older-format replies (understanding / recommendation / reasoning) are shown as one answer without the filler labels.
 */
function StructuredCard({
  response,
  onFollowUp,
}: {
  response: ZuloResponse
  onFollowUp?: (question: string) => void
}) {
  const recs = Array.isArray(response.recommendation)
    ? response.recommendation
    : [response.recommendation]

  const sources = (response.sources ?? []).filter(
    (s): s is string => typeof s === "string" && s.trim().length > 0,
  )

  const pulseLead = response.pulseLead?.trim() ?? ""
  const stripLead = (t: string) => (pulseLead && t.trim().startsWith(pulseLead) ? t.trim().slice(pulseLead.length).trim() : t.trim())
  const understanding = stripLead(response.understanding ?? "")
  const reasoning = response.reasoning?.trim() ?? ""
  const answerParts = recs.map((r) => stripLead(r ?? "")).filter((r) => !isPlaceholderText(r))
  const followUps = (response.followUps ?? []).slice(0, 3)
  // Older replies carried "next steps"; show them as a plain list only when there is no new-style follow-up.
  const legacySteps = followUps.length === 0 ? (response.nextSteps ?? []) : []

  return (
    <div className="response-block">
      {!isPlaceholderText(understanding) ? <ZuloRichText text={understanding} /> : null}

      <div className="response-section response-section-primary">
        {answerParts.length <= 1 ? (
          <ZuloRichText text={answerParts[0] ?? "I couldn't put an answer together that time. Please ask again."} emphasis />
        ) : (
          <ul className="zulo-rich-list response-rec-list">
            {answerParts.map((rec, i) => (
              <li key={i}>
                <ZuloRichText text={rec} emphasis />
              </li>
            ))}
          </ul>
        )}
      </div>

      {!isPlaceholderText(reasoning) ? <ZuloRichText text={reasoning} /> : null}

      {legacySteps.length > 0 ? (
        <ul className="zulo-rich-list">
          {legacySteps.map((step, i) => (
            <li key={i}>
              <ZuloRichText text={step} />
            </li>
          ))}
        </ul>
      ) : null}

      {pulseLead ? (
        <p className="response-pulse-text mono" aria-label="Trust signal">
          {pulseLead.replace(/ Ranked paths below are conditioned on this\.$/, "")}
        </p>
      ) : null}

      {sources.length > 0 ? (
        <div className="response-meta mono">
          <span>Sources</span>
          <ul className="response-sources">
            {sources.slice(0, 4).map((src, i) => {
              const href = trustedHref(src.trim())
              return (
                <li key={i}>
                  {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="zulo-rich-link">
                      {src.replace(/^https?:\/\//i, "").replace(/\/$/, "")}
                    </a>
                  ) : (
                    src
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      {onFollowUp && followUps.length > 0 ? (
        <div className="ask-followups" role="group" aria-label="Ask a follow-up">
          {followUps.map((q, i) => (
            <button key={i} type="button" className="ask-followup" onClick={() => onFollowUp(q)}>
              {q}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
