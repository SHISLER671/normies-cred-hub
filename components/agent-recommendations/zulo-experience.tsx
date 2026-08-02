"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useAccount } from "wagmi"
import { ExternalLink, Loader2, Send } from "lucide-react"

import { useActiveNormie } from "@/components/active-normie-provider"
import { ActiveNormieBadge } from "@/components/active-normie-switcher"
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

/** Core + strategy skill chips (on-demand scans). */
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

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export function ZuloExperience({ defaultTokenId = ZULO_IDENTITY.tokenId }: { defaultTokenId?: number }) {
  const { address, isConnected } = useAccount()
  const { data: ensName } = useEnsName(address)
  const { activeTokenId } = useActiveNormie()

  const tokenId = activeTokenId ?? defaultTokenId
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [pulse, setPulse] = useState<ZuloPulseView | null>(null)
  const [zuloAP, setZuloAP] = useState(0)
  const [pulseLoading, setPulseLoading] = useState(true)
  const [showPulse, setShowPulse] = useState(false)
  const [expandedOpportunity, setExpandedOpportunity] = useState<number | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const [opportunitiesCollapsed, setOpportunitiesCollapsed] = useState(true)
  const [introOpen, setIntroOpen] = useState(false)
  const [skillsOpen, setSkillsOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  const welcomeSent = useRef(false)

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
    })
  }, [])

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)")
    const apply = () => {
      const mobile = mq.matches
      setIsMobile(mobile)
      // Desktop: open skills tray + opps by default; mobile stays collapsed for density
      if (!mobile) {
        setOpportunitiesCollapsed(false)
        setSkillsOpen(true)
        setIntroOpen(true)
      }
    }
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
          "Structure first. I am Zulo — Strategic Architect for the pixel economy. PULSE, burns, market signals, canvas transforms. What are we deciding?",
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

  const visibleOpportunities = isMobile ? opportunities.slice(0, 3) : opportunities
  const showOppsSection = opportunities.length > 0 && !(isMobile && keyboardOpen)
  const showQuickPrompts = !keyboardOpen && skillsOpen
  const visibleQuickPrompts = isMobile ? QUICK_PROMPTS.slice(0, 5) : QUICK_PROMPTS
  const oppsOpen = !opportunitiesCollapsed

  return (
    <div
      className={cn(
        "zulo-chrome ask-shell ask-modular",
        isMobile && "is-mobile",
        keyboardOpen && "keyboard-open",
      )}
    >
      <div className="ask-top" ref={topRef}>
        <ZuloChromeHeader
          active="ask"
          fixed={false}
          trailing={
            <div className="header-trailing">
              <button
                type="button"
                className={cn(
                  "pulse-toggle",
                  showPulse && "is-open",
                  isMobile && "pulse-toggle-compact",
                )}
                onClick={() => setShowPulse((v) => !v)}
                aria-expanded={showPulse}
                aria-controls="pulse-dropdown"
              >
                <span className="pulse-indicator">PULSE</span>
                {!isMobile ? (
                  <span className="pulse-tier mono muted">{pulseTierLabel}</span>
                ) : null}
                <span className={cn("pulse-toggle-chevron", showPulse && "is-open")}>
                  ▼
                </span>
              </button>
              {!isMobile && isConnected && address ? (
                <span className="mono muted" style={{ fontSize: 11 }}>
                  {ensName || shortAddr(address)}
                </span>
              ) : null}
              <ConnectWallet />
            </div>
          }
        />

        {showPulse ? (
          <div
            id="pulse-dropdown"
            className="pulse-dropdown animate-slide-down"
            role="region"
            aria-label="PULSE data"
          >
            <div className="pulse-dropdown-inner">
              {pulse ? (
                <>
                  <div className="pulse-grid">
                    <PulseField label="Token" value={`#${pulse.tokenId}`} />
                    <PulseField
                      label="Status"
                      value={
                        <span
                          className={
                            pulse.status === "awakened" ? "status-live" : undefined
                          }
                        >
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
                    <PulseField
                      label="AP"
                      value={String(pulse.canvas.actionPoints)}
                    />
                    <PulseField
                      label="Rarity"
                      value={
                        <span style={{ textTransform: "capitalize" }}>
                          {pulse.rarity.tier}
                        </span>
                      }
                    />
                    <PulseField
                      label="Rank"
                      value={
                        pulse.rarity.rank != null ? `#${pulse.rarity.rank}` : "—"
                      }
                    />
                    <PulseField
                      label="Score"
                      value={
                        pulse.rarity.score != null
                          ? pulse.rarity.score.toFixed(1)
                          : "—"
                      }
                    />
                    <PulseField
                      label="Type"
                      value={
                        <span style={{ textTransform: "capitalize" }}>
                          {pulse.type}
                        </span>
                      }
                    />
                  </div>

                  {pulse.credHub ? (
                    <div style={{ marginTop: 16 }}>
                      <p className="caption">CredHub PULSE</p>
                      <p className="mono" style={{ marginTop: 4 }}>
                        {pulse.credHub.pulseLevel}/{pulse.credHub.maxLevel} ·{" "}
                        {pulse.credHub.status}
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
                  {pulseLoading
                    ? "Loading PULSE…"
                    : "PULSE unavailable. Try again later."}
                </p>
              )}
            </div>
          </div>
        ) : null}
      </div>

      <div className="ask-body">
        {/* Module 1 — Identity / intro (collapsible) */}
        <section className={cn("ask-module", introOpen && "is-open")}>
          <button
            type="button"
            className="ask-module-toggle"
            onClick={() => setIntroOpen((v) => !v)}
            aria-expanded={introOpen}
          >
            <span className="ask-module-toggle-label">
              <span className="mono">ZULO</span>
              <span className="ask-module-meta">
                Agent #{ZULO_IDENTITY.agentId} · subject #{tokenId} · Concierge
              </span>
            </span>
            <span className={cn("pulse-toggle-chevron", introOpen && "is-open")}>
              ▼
            </span>
          </button>
          {introOpen ? (
            <div className="ask-module-body">
              <ActiveNormieBadge />
              <p className="ask-intro-text" style={{ marginTop: 12 }}>
                High-signal help for burns, trait/tool choices, and Canvas edits.
                Prefer ranked tryable actions?{" "}
                <a href="/paths" className="ask-inline-link">
                  Free Moves →
                </a>
              </p>
              <p className="caption" style={{ marginTop: 10, marginBottom: 0 }}>
                NormiesCredHub PULSE Tool #53 · free chat · no keys · subject #
                {tokenId}
              </p>
            </div>
          ) : null}
        </section>

        {/* Module 2 — Chat (primary, always open) */}
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
              {/* Module 3 — Skills tray (expandable) */}
              {!keyboardOpen ? (
                <div className={cn("ask-skills-tray", skillsOpen && "is-open")}>
                  <button
                    type="button"
                    className="ask-skills-toggle"
                    onClick={() => setSkillsOpen((v) => !v)}
                    aria-expanded={skillsOpen}
                  >
                    <span>Skills / intents</span>
                    <span
                      className={cn("pulse-toggle-chevron", skillsOpen && "is-open")}
                    >
                      ▼
                    </span>
                  </button>
                  {showQuickPrompts ? (
                    <div
                      className={cn(
                        "quick-prompts",
                        isMobile && "scrollbar-hide quick-prompts-scroll",
                      )}
                    >
                      {visibleQuickPrompts.map((item) => (
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
                  ) : null}
                </div>
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

        {/* Module 4 — Opportunities / live signals (collapsible) */}
        {showOppsSection ? (
          <section
            className={cn(
              "ask-module ask-module-opps",
              oppsOpen && "is-open",
              isMobile && !oppsOpen && "is-collapsed",
            )}
            aria-label="Opportunities"
          >
            <button
              type="button"
              className="ask-module-toggle"
              onClick={() => setOpportunitiesCollapsed((v) => !v)}
              aria-expanded={oppsOpen}
            >
              <span className="ask-module-toggle-label">
                <span>Opportunities / live signals</span>
                <span className="ask-module-meta mono">
                  {opportunities.length}
                </span>
              </span>
              <span className={cn("pulse-toggle-chevron", oppsOpen && "is-open")}>
                ▼
              </span>
            </button>
            {oppsOpen ? (
              <div className="ask-module-body ask-opps-body">
                <div className={cn("opp-rail", isMobile && "scrollbar-hide")}>
                  {visibleOpportunities.map((rec, i) => {
                    const open = expandedOpportunity === i
                    return (
                      <div
                        key={`${i}-${rec.slice(0, 20)}`}
                        className={cn("opp-chip", open && "is-expanded")}
                        role="button"
                        tabIndex={0}
                        onClick={() =>
                          setExpandedOpportunity(open ? null : i)
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            setExpandedOpportunity(open ? null : i)
                          }
                        }}
                      >
                        <div className="opp-chip-head">
                          <span className="mono muted">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span
                            className={cn(
                              "pulse-toggle-chevron",
                              open && "is-open",
                            )}
                          >
                            ▼
                          </span>
                        </div>
                        <p
                          className={cn("opp-chip-body", !open && "clamped")}
                        >
                          {rec}
                        </p>
                        {open ? (
                          <div
                            className="opp-chip-expand"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            <p className="caption">
                              Ask Zulo about this opportunity
                            </p>
                            <button
                              type="button"
                              className="button button-primary button-sm"
                              disabled={loading}
                              onClick={() => {
                                setExpandedOpportunity(null)
                                if (isMobile) setOpportunitiesCollapsed(true)
                                void sendMessage(
                                  `Tell me more about this opportunity: ${rec}`,
                                )
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
            ) : null}
          </section>
        ) : null}

        {!keyboardOpen ? (
          <p className="dyor">
            Informational only — DYOR. Burns are permanent. Zulo never asks for
            keys.
          </p>
        ) : null}
      </div>
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
