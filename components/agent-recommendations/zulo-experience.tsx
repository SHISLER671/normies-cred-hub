"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useAccount } from "wagmi"
import { ExternalLink, Loader2, RefreshCw, Send } from "lucide-react"

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
  const [pulseError, setPulseError] = useState<string | null>(null)
  const [pulseFresh, setPulseFresh] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const welcomeSent = useRef(false)

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    })
  }, [])

  const fetchPulse = useCallback(async () => {
    setPulseLoading(true)
    setPulseError(null)
    try {
      const res = await fetch(`/api/zulo/pulse/${tokenId}`, { cache: "no-store" })
      const data = (await res.json()) as ZuloPulseApiResponse
      if (!res.ok || !data.pulse) {
        setPulseError(data.error || "Failed to load PULSE")
        setPulse(null)
        return
      }
      setPulse(data.pulse)
      setZuloAP(data.zuloAP ?? 0)
      setPulseFresh(true)
      window.setTimeout(() => setPulseFresh(false), 600)
    } catch {
      setPulseError("Failed to load PULSE")
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
          "Welcome. I am Zulo, awakened from Normie #7141. I read live PULSE — Canvas, rarity, CredHub signals — and help you maximize your position. What shall we explore?",
      },
    ])
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading, scrollToBottom])

  async function sendMessage(raw?: string) {
    const userQuery = (raw ?? input).trim()
    if (!userQuery || loading) return
    if (userQuery.length > MAX_USER_QUERY_CHARS) return

    const turnId = crypto.randomUUID()
    setMessages((prev) => [...prev, { id: turnId, role: "user", content: userQuery }])
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

  const opportunities = pulse?.recommendations?.slice(0, 6) ?? []

  return (
    <div className="zulo-chrome">
      <ZuloChromeHeader
        active="ask"
        fixed={false}
        trailing={
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
            <div className="caption" style={{ textAlign: "right" }}>
              <div>Canvas AP · #{ZULO_IDENTITY.tokenId}</div>
              <div className="mono" style={{ color: "var(--text-primary)" }}>
                {zuloAP} AP
              </div>
            </div>
            {isConnected && address ? (
              <span className="mono muted">{ensName || shortAddr(address)}</span>
            ) : null}
            <ConnectWallet />
          </div>
        }
      />

      <div className="identity-strip">
        <div className="identity-mark">
          Z
          <span className="live-dot" aria-hidden />
        </div>
        <div>
          <h1 style={{ fontSize: 18, margin: 0, letterSpacing: "0.12em" }}>Zulo</h1>
          <p className="mono muted" style={{ margin: 0, fontSize: 12 }}>
            Agent #{ZULO_IDENTITY.agentId} · {ZULO_IDENTITY.ens}
          </p>
        </div>
      </div>

      <div className="ask-layout">
        {/* PULSE sidebar */}
        <div className="stack">
          <div className={cn("card pulse-card", pulseFresh && "data-pulse")}>
            <div className="card-header">
              <h2 className="card-title">
                <span className="pulse-indicator">PULSE</span>
              </h2>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="mono muted">#{tokenId}</span>
                <button
                  type="button"
                  className="button button-sm"
                  onClick={() => void fetchPulse()}
                  aria-label="Refresh PULSE"
                >
                  <RefreshCw className={cn("size-3.5", pulseLoading && "animate-spin")} />
                </button>
              </div>
            </div>

            {pulseLoading && !pulse ? (
              <p className="caption text-center">Loading PULSE…</p>
            ) : pulseError && !pulse ? (
              <div className="text-center stack">
                <p className="muted">{pulseError}</p>
                <button type="button" className="button button-sm" onClick={() => void fetchPulse()}>
                  Retry
                </button>
              </div>
            ) : pulse ? (
              <div className="stack">
                {pulse.credHub ? (
                  <div>
                    <div className="card-row">
                      <span className="card-row-label">CredHub PULSE</span>
                      <span className="card-row-value mono">
                        {pulse.credHub.pulseLevel}/{pulse.credHub.maxLevel} · {pulse.credHub.status}
                      </span>
                    </div>
                    <div className="meter" style={{ marginTop: 8 }}>
                      <div
                        className="meter-fill"
                        style={{
                          width: `${(pulse.credHub.pulseLevel / pulse.credHub.maxLevel) * 100}%`,
                        }}
                      />
                    </div>
                    {pulse.credHub.breakdown.length > 0 ? (
                      <p className="caption" style={{ marginTop: 8 }}>
                        {pulse.credHub.breakdown.join(" · ")}
                      </p>
                    ) : null}
                    {pulse.credHub.gaps.length > 0 ? (
                      <p className="caption" style={{ marginTop: 4 }}>
                        Gaps: {pulse.credHub.gaps.join(" · ")}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="card-row">
                  <span className="card-row-label">Status</span>
                  <span
                    className={cn(
                      "card-row-value",
                      pulse.status === "awakened" ? "status-live" : "muted",
                    )}
                  >
                    {pulse.status}
                  </span>
                </div>
                <div className="card-row">
                  <span className="card-row-label">Type</span>
                  <span className="card-row-value" style={{ textTransform: "capitalize" }}>
                    {pulse.type}
                  </span>
                </div>
                <div className="card-row">
                  <span className="card-row-label">Canvas</span>
                  <span className="card-row-value">
                    {pulse.canvas.edited
                      ? `Modified · L${pulse.canvas.level} · ${pulse.canvas.actionPoints} AP`
                      : `Untouched · L${pulse.canvas.level}`}
                  </span>
                </div>
                <div className="card-row">
                  <span className="card-row-label">Rarity</span>
                  <span className="card-row-value">
                    <span style={{ textTransform: "capitalize" }}>{pulse.rarity.tier}</span>
                    {pulse.rarity.rank != null ? (
                      <span className="mono muted"> #{pulse.rarity.rank}</span>
                    ) : null}
                  </span>
                </div>

                {pulse.rarity.score != null ? (
                  <div>
                    <div className="card-row">
                      <span className="card-row-label">Score</span>
                      <span className="card-row-value mono">{pulse.rarity.score.toFixed(2)}</span>
                    </div>
                    <div className="meter">
                      <div
                        className="meter-fill"
                        style={{
                          width: `${Math.min(Math.max(pulse.rarity.score, 0), 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ) : null}

                {pulse.pulseSummary ? (
                  <p className="card-body" style={{ marginBottom: 0 }}>
                    {pulse.pulseSummary}
                  </p>
                ) : null}

                <div className="sidebar-actions">
                  <a
                    href={ECOSYSTEM_LINKS.canvasEdit(tokenId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="button button-block button-sm"
                  >
                    Edit Canvas <ExternalLink className="size-3.5" />
                  </a>
                  <a
                    href={`${ECOSYSTEM_LINKS.rarity}${tokenId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="button button-block button-sm"
                  >
                    View Rarity <ExternalLink className="size-3.5" />
                  </a>
                  <button
                    type="button"
                    className="button button-primary button-block button-sm"
                    disabled={loading}
                    onClick={() => void sendMessage("Analyze my PULSE")}
                  >
                    Ask Zulo about PULSE
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="card">
            <h3 className="card-title">About Zulo</h3>
            <p className="card-body">
              Awakened from Normie #{ZULO_IDENTITY.tokenId}. I interpret live PULSE and give
              strategic recommendations for the Normies ecosystem.
            </p>
            <div className="card-row">
              <span className="card-row-label">Service</span>
              <span className="card-row-value">A2A Recommendations</span>
            </div>
            <div className="card-row">
              <span className="card-row-label">Pricing</span>
              <span className="card-row-value">1–2 AP · chat free</span>
            </div>
            <div className="card-row">
              <span className="card-row-label">Hot Wallet</span>
              <span className="card-row-value mono">{shortAddr(ZULO_IDENTITY.hotWallet)}</span>
            </div>
          </div>
        </div>

        {/* Chat */}
        <div className="chat-shell">
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
                placeholder="Ask Zulo about your PULSE, strategy, or the ecosystem…"
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
      </div>

      {opportunities.length > 0 ? (
        <div className="container" style={{ paddingBottom: 40 }}>
          <h2 className="caption" style={{ marginBottom: 16 }}>
            Opportunities
          </h2>
          <div className="opp-grid">
            {opportunities.map((rec, i) => (
              <button
                key={`${i}-${rec.slice(0, 24)}`}
                type="button"
                className="opp-card pulse-card"
                disabled={loading}
                onClick={() => void sendMessage(`Tell me more about this opportunity: ${rec}`)}
              >
                <div className="card-header" style={{ border: "none", padding: 0, marginBottom: 12 }}>
                  <span className="mono muted">{String(i + 1).padStart(2, "0")}</span>
                  <span>■</span>
                </div>
                <p className="card-body" style={{ marginBottom: 8 }}>
                  {rec}
                </p>
                <span className="caption">Ask Zulo →</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <p className="dyor">
        Informational only — not financial advice. DYOR. Burns are permanent. Zulo never asks for
        keys or signatures.
      </p>
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
