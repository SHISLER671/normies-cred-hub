"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useAccount } from "wagmi"
import { ExternalLink, Loader2, Send } from "lucide-react"

import { ConnectWallet } from "@/components/connect-wallet"
import { ZuloChromeHeader } from "@/components/zulo-chrome-header"
import { useEnsName } from "@/hooks/use-ens-name"
import {
  ECOSYSTEM_LINKS,
  MAX_SESSION_HISTORY,
  MAX_USER_QUERY_CHARS,
  ZULO_IDENTITY,
  type ZuloPulseApiResponse,
  type ZuloPulseView,
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

const QUICK_PROMPTS = [
  "Analyze my PULSE",
  "How do I earn more AP?",
  "Should I edit my Canvas?",
  "What's my rarity strategy?",
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

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export function ZuloExperience({ defaultTokenId = ZULO_IDENTITY.tokenId }: { defaultTokenId?: number }) {
  const { address, isConnected } = useAccount()
  const { data: ensName } = useEnsName(address)

  const [tokenId] = useState(defaultTokenId)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [pulse, setPulse] = useState<ZuloPulseView | null>(null)
  const [zuloAP, setZuloAP] = useState(0)
  const [pulseLoading, setPulseLoading] = useState(true)
  const [showPulse, setShowPulse] = useState(false)
  const [expandedOpportunity, setExpandedOpportunity] = useState<number | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  const welcomeSent = useRef(false)

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
    })
  }, [])

  const fetchPulse = useCallback(async () => {
    setPulseLoading(true)
    try {
      const res = await fetch(`/api/zulo/pulse/${tokenId}`, { cache: "no-store" })
      const data = (await res.json()) as ZuloPulseApiResponse
      if (!res.ok || !data.pulse) {
        setPulse(null)
        return
      }
      setPulse(data.pulse)
      setZuloAP(data.zuloAP ?? 0)
    } catch {
      setPulse(null)
    } finally {
      setPulseLoading(false)
    }
  }, [tokenId])

  useEffect(() => {
    void fetchPulse()
  }, [fetchPulse])

  useEffect(() => {
    if (welcomeSent.current) return
    welcomeSent.current = true
    setMessages([
      {
        id: "welcome",
        role: "zulo",
        content:
          "I am listening. What would you like to know about your PULSE, your strategy, or the ecosystem?",
      },
    ])
  }, [])

  useEffect(() => {
    if (messages.length > 1 || loading) scrollToBottom()
  }, [messages, loading, scrollToBottom])

  // Close PULSE dropdown on Escape / outside click
  useEffect(() => {
    if (!showPulse) return

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setShowPulse(false)
    }

    function onPointer(e: MouseEvent | TouchEvent) {
      const el = topRef.current
      if (!el) return
      if (e.target instanceof Node && !el.contains(e.target)) {
        setShowPulse(false)
      }
    }

    document.addEventListener("keydown", onKey)
    document.addEventListener("mousedown", onPointer)
    document.addEventListener("touchstart", onPointer)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("mousedown", onPointer)
      document.removeEventListener("touchstart", onPointer)
    }
  }, [showPulse])

  async function sendMessage(raw?: string) {
    const userQuery = (raw ?? input).trim()
    if (!userQuery || loading) return
    if (userQuery.length > MAX_USER_QUERY_CHARS) return

    setShowPulse(false)
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content: userQuery }])
    setInput("")
    setLoading(true)

    const sessionHistory = messages
      .filter((m) => m.role === "user" || m.structured)
      .reduce<Array<{ userMessage: string; zuloResponse: string }>>((acc, m, i, arr) => {
        if (m.role !== "user") return acc
        const next = arr[i + 1]
        if (next?.role === "zulo" && next.structured) {
          acc.push({
            userMessage: m.content,
            zuloResponse: formatZuloReplyForHistory(next.structured),
          })
        }
        return acc
      }, [])
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

      const data = (await res.json().catch(() => ({}))) as ZuloResponse & { error?: string }

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "zulo",
            content: data.error || `Something went wrong (${res.status}). Please try again.`,
            error: data.error,
          },
        ])
        return
      }

      const structured: ZuloResponse = {
        understanding: data.understanding || "I received your request.",
        recommendation: data.recommendation ?? "No specific recommendation available.",
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

  const opportunities = pulse?.recommendations?.slice(0, 8) ?? []
  const pulseTierLabel = pulseLoading
    ? "…"
    : pulse?.rarity.tier || pulse?.status || "—"

  return (
    <div className="zulo-chrome ask-shell">
      <div className="ask-top" ref={topRef}>
        <ZuloChromeHeader
          active="ask"
          fixed={false}
          trailing={
            <div className="header-trailing">
              <button
                type="button"
                className={cn("pulse-toggle", showPulse && "is-open")}
                onClick={() => setShowPulse((v) => !v)}
                aria-expanded={showPulse}
                aria-controls="pulse-dropdown"
              >
                <span className="pulse-indicator">PULSE</span>
                <span className="pulse-tier mono muted">{pulseTierLabel}</span>
                <span className={cn("pulse-toggle-chevron", showPulse && "is-open")}>▼</span>
              </button>
              {isConnected && address ? (
                <span className="mono muted" style={{ fontSize: 11 }}>
                  {ensName || shortAddr(address)}
                </span>
              ) : null}
              <ConnectWallet />
            </div>
          }
        />

        {showPulse ? (
          <div id="pulse-dropdown" className="pulse-dropdown animate-slide-down" role="region" aria-label="PULSE data">
            <div className="pulse-dropdown-inner">
              {pulse ? (
                <>
                  <div className="pulse-grid">
                    <PulseField label="Token" value={`#${pulse.tokenId}`} />
                    <PulseField
                      label="Status"
                      value={
                        <span className={pulse.status === "awakened" ? "status-live" : undefined}>
                          {pulse.status}
                        </span>
                      }
                    />
                    <PulseField
                      label="Canvas"
                      value={
                        pulse.canvas.edited
                          ? `Modified · L${pulse.canvas.level}`
                          : `Untouched · L${pulse.canvas.level}`
                      }
                    />
                    <PulseField label="AP" value={String(pulse.canvas.actionPoints)} />
                    <PulseField
                      label="Rarity"
                      value={<span style={{ textTransform: "capitalize" }}>{pulse.rarity.tier}</span>}
                    />
                    <PulseField
                      label="Rank"
                      value={pulse.rarity.rank != null ? `#${pulse.rarity.rank}` : "—"}
                    />
                    <PulseField
                      label="Score"
                      value={
                        pulse.rarity.score != null ? pulse.rarity.score.toFixed(1) : "—"
                      }
                    />
                    <PulseField
                      label="Type"
                      value={<span style={{ textTransform: "capitalize" }}>{pulse.type}</span>}
                    />
                  </div>

                  {pulse.credHub ? (
                    <div style={{ marginTop: 16 }}>
                      <p className="caption">CredHub PULSE</p>
                      <p className="mono" style={{ marginTop: 4 }}>
                        {pulse.credHub.pulseLevel}/{pulse.credHub.maxLevel} · {pulse.credHub.status}
                      </p>
                      {pulse.credHub.gaps.length > 0 ? (
                        <p className="caption" style={{ marginTop: 6 }}>
                          Gaps: {pulse.credHub.gaps.join(" · ")}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {pulse.pulseSummary ? (
                    <p className="card-body" style={{ marginTop: 12, marginBottom: 0 }}>
                      {pulse.pulseSummary}
                    </p>
                  ) : null}

                  <p className="caption" style={{ marginTop: 12 }}>
                    Zulo Canvas AP · #{ZULO_IDENTITY.tokenId}: {zuloAP}
                  </p>

                  <div className="pulse-dropdown-actions">
                    <a
                      href={ECOSYSTEM_LINKS.canvasEdit(pulse.tokenId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="button button-sm"
                      onClick={() => setShowPulse(false)}
                    >
                      Edit Canvas <ExternalLink className="size-3.5" />
                    </a>
                    <a
                      href={`${ECOSYSTEM_LINKS.rarity}${pulse.tokenId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="button button-sm"
                      onClick={() => setShowPulse(false)}
                    >
                      View Rarity <ExternalLink className="size-3.5" />
                    </a>
                    <button
                      type="button"
                      className="button button-primary button-sm"
                      disabled={loading}
                      onClick={() => void sendMessage("Analyze my PULSE")}
                    >
                      Analyze my PULSE
                    </button>
                  </div>
                </>
              ) : (
                <p className="caption text-center">
                  {pulseLoading ? "Loading PULSE…" : "PULSE unavailable. Try again later."}
                </p>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* Centered chat stage */}
      <main className="ask-main">
        <div className="ask-chat">
          <div className="chat-messages">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "chat-message",
                  msg.role === "user" ? "chat-message-user" : "chat-message-zulo",
                )}
              >
                {msg.role === "zulo" ? <div className="chat-avatar">Z</div> : null}
                <div className="chat-stack">
                  <div className="chat-bubble">{msg.content}</div>
                  {msg.structured && msg.role === "zulo" ? (
                    <StructuredCard response={msg.structured} />
                  ) : null}
                </div>
              </div>
            ))}

            {loading ? (
              <div className="chat-message chat-message-zulo">
                <div className="chat-avatar">Z</div>
                <div className="chat-bubble" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Loader2 className="size-4 animate-spin" />
                  Thinking…
                </div>
              </div>
            ) : null}

            <div ref={messagesEndRef} />
          </div>

          <div className="chat-footer">
            <div className="quick-prompts">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="quick-prompt"
                  disabled={loading}
                  onClick={() => void sendMessage(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
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
                placeholder="Ask Zulo…"
                maxLength={MAX_USER_QUERY_CHARS}
                disabled={loading}
              />
              <button
                type="button"
                className="button button-primary"
                disabled={!canSend}
                onClick={() => void sendMessage()}
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                Ask
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Compact opportunities rail */}
      {opportunities.length > 0 ? (
        <section className="opp-rail-section" aria-label="Opportunities">
          <div className="opp-rail-inner">
            <p className="caption" style={{ marginBottom: 8 }}>
              Opportunities
            </p>
            <div className="opp-rail">
              {opportunities.map((rec, i) => {
                const open = expandedOpportunity === i
                return (
                  <div
                    key={`${i}-${rec.slice(0, 20)}`}
                    className={cn("opp-chip", open && "is-expanded")}
                    role="button"
                    tabIndex={0}
                    onClick={() => setExpandedOpportunity(open ? null : i)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        setExpandedOpportunity(open ? null : i)
                      }
                    }}
                  >
                    <div className="opp-chip-head">
                      <span className="mono muted">{String(i + 1).padStart(2, "0")}</span>
                      <span className={cn("pulse-toggle-chevron", open && "is-open")}>▼</span>
                    </div>
                    <p className={cn("opp-chip-body", !open && "clamped")}>{rec}</p>
                    {open ? (
                      <div
                        className="opp-chip-expand"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <p className="caption">Ask Zulo about this opportunity</p>
                        <button
                          type="button"
                          className="button button-primary button-sm"
                          disabled={loading}
                          onClick={() => {
                            setExpandedOpportunity(null)
                            void sendMessage(`Tell me more about this opportunity: ${rec}`)
                          }}
                        >
                          Ask Zulo →
                        </button>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      ) : null}

      <p className="dyor">
        Informational only — DYOR. Burns are permanent. Zulo never asks for keys.
      </p>
    </div>
  )
}

function PulseField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="pulse-field">
      <p className="caption">{label}</p>
      <div className="mono">{value}</div>
    </div>
  )
}

function StructuredCard({ response }: { response: ZuloResponse }) {
  const confidence =
    typeof response.confidence === "number" && Number.isFinite(response.confidence)
      ? Math.max(0, Math.min(100, Math.round(response.confidence)))
      : 70

  const recs = Array.isArray(response.recommendation)
    ? response.recommendation
    : [response.recommendation]

  return (
    <div className="response-block">
      <div className="response-section">
        <p className="response-label">Understanding</p>
        <p>{response.understanding}</p>
      </div>
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
      {response.reasoning ? (
        <div className="response-section">
          <p className="response-label">Reasoning</p>
          <p>{response.reasoning}</p>
        </div>
      ) : null}
      {response.nextSteps?.length > 0 ? (
        <div className="response-section">
          <p className="response-label">Next steps</p>
          {response.nextSteps.map((step, i) => (
            <div key={i} className="step-row">
              <span className="step-arrow">→</span>
              <span>{step}</span>
            </div>
          ))}
        </div>
      ) : null}
      {response.sources && response.sources.length > 0 ? (
        <div className="response-section">
          <p className="response-label">Sources</p>
          <ul style={{ paddingLeft: 0, listStyle: "none", margin: 0 }}>
            {response.sources.map((s, i) => (
              <li key={i} className="mono" style={{ fontSize: 11, wordBreak: "break-all" }}>
                {/^https?:\/\//i.test(s) ? (
                  <a href={s} target="_blank" rel="noopener noreferrer">
                    {s}
                  </a>
                ) : (
                  s
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="response-section" style={{ marginBottom: 0 }}>
        <p className="response-label">Confidence · {confidence}%</p>
        <div className="meter">
          <div className="meter-fill" style={{ width: `${confidence}%` }} />
        </div>
      </div>
    </div>
  )
}
