"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useAccount } from "wagmi"
import { Loader2, Send } from "lucide-react"

import { useActiveNormie } from "@/components/active-normie-provider"
import { ConnectWallet } from "@/components/connect-wallet"
import { ZuloChromeHeader } from "@/components/zulo-chrome-header"
import { useEnsName } from "@/hooks/use-ens-name"
import {
  MAX_SESSION_HISTORY,
  MAX_USER_QUERY_CHARS,
  ZULO_IDENTITY,
  type ZuloResponse,
} from "@/lib/agent-recommendations"
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
  defaultTokenId = ZULO_IDENTITY.tokenId,
}: {
  defaultTokenId?: number
}) {
  const { address } = useAccount()
  const { data: ensName } = useEnsName(address)
  const { activeTokenId } = useActiveNormie()

  const tokenId = activeTokenId ?? defaultTokenId
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const [skillsOpen, setSkillsOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
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
          "I am Zulo. Ask about burns, Canvas, PULSE, or the active Normie. What are we deciding?",
      },
    ])
  }, [])

  useEffect(() => {
    if (messages.length > 1 || loading) scrollToBottom()
  }, [messages, loading, scrollToBottom])

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
    setSkillsOpen(false)

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
          normieId: tokenId,
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
        const errText =
          data.error ||
          (res.status === 504
            ? "Timed out waiting for the model. Retry with a shorter question."
            : res.status === 502
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
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "zulo",
          content: "I apologize — the connection faltered. Please try again.",
          error: "network",
        },
      ])
    } finally {
      setLoading(false)
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

      <p className="ask-context-line">
        High-signal help for the active Normie · scoped to on-chain PULSE &amp;
        Canvas — not generic chat
        <span className="ask-context-id mono"> · #{tokenId}</span>
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
                  <div className="chat-bubble">{msg.content}</div>
                  {msg.structured && msg.role === "zulo" ? (
                    <StructuredCard
                      response={msg.structured}
                      compact={isMobile}
                    />
                  ) : null}
                </div>
              </div>
            ))}

            {loading ? (
              <div className="chat-message chat-message-zulo">
                {!isMobile ? <div className="chat-avatar">Z</div> : null}
                <div
                  className="chat-bubble"
                  style={{ display: "flex", alignItems: "center", gap: 8 }}
                >
                  <Loader2 className="size-4 animate-spin" />
                  Thinking…
                </div>
              </div>
            ) : null}

            <div ref={messagesEndRef} />
          </div>

          <div className={cn("chat-footer", keyboardOpen && "pb-safe")}>
            {!keyboardOpen ? (
              <details
                className="ask-skills-details"
                open={skillsOpen}
                onToggle={(e) =>
                  setSkillsOpen((e.target as HTMLDetailsElement).open)
                }
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

  return (
    <div className={cn("response-block", compact && "response-block-compact")}>
      {!compact ? (
        <div className="response-section">
          <p className="response-label">Understanding</p>
          <p>{response.understanding}</p>
        </div>
      ) : null}
      <div className="response-section">
        <p className="response-label">Recommendation</p>
        {recs.length === 1 ? (
          <p className="emphasis">{recs[0]}</p>
        ) : (
          <ul style={{ paddingLeft: 16, margin: 0 }}>
            {recs.map((rec, i) => (
              <li key={i} className="emphasis">
                {rec}
              </li>
            ))}
          </ul>
        )}
      </div>
      {!compact && response.reasoning ? (
        <div className="response-section">
          <p className="response-label">Reasoning</p>
          <p>{response.reasoning}</p>
        </div>
      ) : null}
      {response.nextSteps && response.nextSteps.length > 0 ? (
        <div className="response-section">
          <p className="response-label">Next steps</p>
          <ul style={{ paddingLeft: 16, margin: 0 }}>
            {response.nextSteps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="response-meta mono">
        Confidence {confidence}%
        {response.sources && response.sources.length > 0
          ? ` · ${response.sources.slice(0, 3).join(" · ")}`
          : ""}
      </div>
    </div>
  )
}
