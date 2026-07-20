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
    setMessages((prev) => [
      ...prev,
      { id: turnId, role: "user", content: userQuery },
    ])
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
        {
          id: crypto.randomUUID(),
          role: "zulo",
          content,
          structured,
        },
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
    <div className="zulo-chrome min-h-dvh bg-[#0a0a0a] text-[#f5f5f5]">
      <ZuloChromeHeader
        active="ask"
        fixed={false}
        trailing={
          <div className="flex flex-wrap items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-[10px] text-[#666666]">Canvas AP · #{ZULO_IDENTITY.tokenId}</p>
              <p className="font-mono text-xs text-[#f5f5f5]">{zuloAP} AP</p>
            </div>
            {isConnected && address ? (
              <p className="hidden font-mono text-[11px] text-[#666666] md:block">
                {ensName || shortAddr(address)}
              </p>
            ) : null}
            <ConnectWallet />
          </div>
        }
      />

      {/* Identity strip */}
      <div className="border-b border-[#1f1f1f] bg-[#0d0d0d]">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
          <div className="relative">
            <div className="flex size-10 items-center justify-center rounded-lg border-2 border-[#333333] bg-[#1a1a1a]">
              <span className="font-mono text-lg font-bold text-[#f5f5f5]">Z</span>
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-[#0d0d0d] bg-[#22c55e]" />
          </div>
          <div>
            <h1 className="font-heading text-lg font-bold tracking-tight">Zulo</h1>
            <p className="font-mono text-[11px] text-[#666666]">
              Agent #{ZULO_IDENTITY.agentId} · {ZULO_IDENTITY.ens}
            </p>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left: PULSE */}
          <div className="space-y-6 lg:col-span-1">
            <div className="overflow-hidden rounded-xl border border-[#1f1f1f] bg-[#111111]">
              <div className="flex items-center justify-between border-b border-[#1f1f1f] px-5 py-4">
                <h2 className="text-sm font-semibold tracking-wide">PULSE</h2>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-[#666666]">#{tokenId}</span>
                  <button
                    type="button"
                    onClick={() => void fetchPulse()}
                    className="rounded border border-[#333333] p-1 text-[#666666] transition-colors hover:text-[#f5f5f5]"
                    aria-label="Refresh PULSE"
                  >
                    <RefreshCw className={cn("size-3.5", pulseLoading && "animate-spin")} />
                  </button>
                </div>
              </div>

              {pulseLoading && !pulse ? (
                <div className="p-8 text-center text-sm text-[#666666]">Loading PULSE…</div>
              ) : pulseError && !pulse ? (
                <div className="space-y-3 p-6 text-center">
                  <p className="text-sm text-[#a3a3a3]">{pulseError}</p>
                  <button
                    type="button"
                    onClick={() => void fetchPulse()}
                    className="border border-[#333333] px-3 py-1.5 text-xs hover:border-[#666666]"
                  >
                    Retry
                  </button>
                </div>
              ) : pulse ? (
                <div className="space-y-5 p-5">
                  {pulse.credHub ? (
                    <div>
                      <div className="mb-2 flex justify-between text-xs text-[#666666]">
                        <span>CredHub PULSE</span>
                        <span className="font-mono">
                          {pulse.credHub.pulseLevel}/{pulse.credHub.maxLevel} · {pulse.credHub.status}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[#1a1a1a]">
                        <div
                          className="h-full rounded-full bg-[#f5f5f5] transition-[width]"
                          style={{
                            width: `${(pulse.credHub.pulseLevel / pulse.credHub.maxLevel) * 100}%`,
                          }}
                        />
                      </div>
                      {pulse.credHub.breakdown.length > 0 ? (
                        <p className="mt-2 text-[11px] leading-relaxed text-[#666666]">
                          {pulse.credHub.breakdown.join(" · ")}
                        </p>
                      ) : null}
                      {pulse.credHub.gaps.length > 0 ? (
                        <p className="mt-1 text-[11px] text-[#a3a3a3]">
                          Gaps: {pulse.credHub.gaps.join(" · ")}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <Row
                    label="Status"
                    value={
                      <span
                        className={
                          pulse.status === "awakened" ? "text-[#22c55e]" : "text-[#666666]"
                        }
                      >
                        {pulse.status}
                      </span>
                    }
                  />
                  <Row label="Type" value={<span className="capitalize">{pulse.type}</span>} />
                  <Row
                    label="Canvas"
                    value={
                      <span className={pulse.canvas.edited ? "text-[#f5f5f5]" : "text-[#22c55e]"}>
                        {pulse.canvas.edited
                          ? `Modified · L${pulse.canvas.level} · ${pulse.canvas.actionPoints} AP`
                          : `Untouched · L${pulse.canvas.level}`}
                      </span>
                    }
                  />
                  <Row
                    label="Rarity"
                    value={
                      <span>
                        <span className="capitalize">{pulse.rarity.tier}</span>
                        {pulse.rarity.rank != null ? (
                          <span className="ml-2 font-mono text-xs text-[#666666]">
                            #{pulse.rarity.rank}
                          </span>
                        ) : null}
                      </span>
                    }
                  />

                  {pulse.rarity.score != null ? (
                    <div>
                      <div className="mb-2 flex justify-between text-xs text-[#666666]">
                        <span>Score</span>
                        <span className="font-mono">{pulse.rarity.score.toFixed(2)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[#1a1a1a]">
                        <div
                          className="h-full rounded-full bg-[#f5f5f5]"
                          style={{
                            width: `${Math.min(Math.max(pulse.rarity.score, 0), 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ) : null}

                  {pulse.pulseSummary ? (
                    <p className="border-t border-[#1f1f1f] pt-4 text-xs leading-relaxed text-[#a3a3a3]">
                      {pulse.pulseSummary}
                    </p>
                  ) : null}

                  <div className="space-y-2 border-t border-[#1f1f1f] pt-4">
                    <a
                      href={ECOSYSTEM_LINKS.canvasEdit(tokenId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#333333] bg-[#1a1a1a] py-2.5 text-center text-sm transition-colors hover:bg-[#252525]"
                    >
                      Edit Canvas
                      <ExternalLink className="size-3.5 opacity-60" />
                    </a>
                    <a
                      href={`${ECOSYSTEM_LINKS.rarity}${tokenId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#333333] bg-[#1a1a1a] py-2.5 text-center text-sm transition-colors hover:bg-[#252525]"
                    >
                      View Rarity
                      <ExternalLink className="size-3.5 opacity-60" />
                    </a>
                    <button
                      type="button"
                      onClick={() => void sendMessage("Analyze my PULSE")}
                      disabled={loading}
                      className="w-full rounded-lg border border-[#333333] bg-[#1a1a1a] py-2.5 text-sm transition-colors hover:bg-[#252525] disabled:opacity-50"
                    >
                      Ask Zulo about PULSE
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border border-[#1f1f1f] bg-[#111111] p-5">
              <h3 className="mb-4 text-sm font-semibold">About Zulo</h3>
              <p className="mb-4 text-sm leading-relaxed text-[#a3a3a3]">
                Awakened from Normie #{ZULO_IDENTITY.tokenId}. I interpret live PULSE and give
                strategic recommendations for the Normies ecosystem.
              </p>
              <div className="space-y-2 text-xs text-[#666666]">
                <div className="flex justify-between gap-2">
                  <span>Service</span>
                  <span className="text-[#a3a3a3]">A2A Recommendations</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>Pricing</span>
                  <span className="text-[#a3a3a3]">1–2 AP (A2A) · chat free</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>Hot Wallet</span>
                  <span className="font-mono text-[#a3a3a3]">
                    {shortAddr(ZULO_IDENTITY.hotWallet)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Chat */}
          <div className="flex h-[min(70vh,700px)] flex-col lg:col-span-2 lg:h-[700px]">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#1f1f1f] bg-[#111111]">
              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4 sm:p-6">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex",
                      msg.role === "user" ? "justify-end" : "justify-start",
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[92%] sm:max-w-[85%]",
                        msg.role === "zulo" && "flex gap-3",
                      )}
                    >
                      {msg.role === "zulo" ? (
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[#333333] bg-[#1a1a1a]">
                          <span className="font-mono text-sm font-bold">Z</span>
                        </div>
                      ) : null}
                      <div className={cn("space-y-2", msg.role === "user" && "text-right")}>
                        <div
                          className={cn(
                            "inline-block px-4 py-3 text-left text-sm leading-relaxed",
                            msg.role === "user"
                              ? "rounded-2xl bg-[#f5f5f5] text-[#0a0a0a]"
                              : "rounded-2xl bg-[#1a1a1a] text-[#f5f5f5]",
                          )}
                        >
                          {msg.content}
                        </div>

                        {msg.structured && msg.role === "zulo" ? (
                          <StructuredCard response={msg.structured} />
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}

                {loading ? (
                  <div className="flex gap-3">
                    <div className="flex size-8 items-center justify-center rounded-lg border border-[#333333] bg-[#1a1a1a]">
                      <span className="font-mono text-sm font-bold">Z</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-2xl bg-[#1a1a1a] px-4 py-3 text-sm text-[#666666]">
                      <Loader2 className="size-4 animate-spin" />
                      Thinking…
                    </div>
                  </div>
                ) : null}

                <div ref={messagesEndRef} />
              </div>

              <div className="border-t border-[#1f1f1f] p-4">
                <div className="mb-4 flex flex-wrap gap-2">
                  {QUICK_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      disabled={loading}
                      onClick={() => void sendMessage(prompt)}
                      className="rounded-full border border-[#333333] bg-[#1a1a1a] px-3 py-1.5 text-xs text-[#a3a3a3] transition-colors hover:border-[#666666] hover:text-[#f5f5f5] disabled:opacity-50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>

                <div className="flex gap-3">
                  <input
                    type="text"
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
                    className="flex-1 rounded-xl border border-[#333333] bg-[#1a1a1a] px-4 py-3 text-sm text-[#f5f5f5] placeholder-[#666666] transition-colors focus:border-[#666666] focus:outline-none disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => void sendMessage()}
                    disabled={!canSend}
                    className="flex items-center gap-2 rounded-xl bg-[#f5f5f5] px-5 py-3 font-medium text-[#0a0a0a] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                    Ask
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Opportunities */}
        {opportunities.length > 0 ? (
          <div className="mt-8">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#666666]">
              Opportunities
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {opportunities.map((rec, i) => (
                <button
                  key={`${i}-${rec.slice(0, 24)}`}
                  type="button"
                  disabled={loading}
                  onClick={() => void sendMessage(`Tell me more about this opportunity: ${rec}`)}
                  className="rounded-xl border border-[#1f1f1f] bg-[#111111] p-5 text-left transition-colors hover:border-[#333333] disabled:opacity-50"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <span className="font-mono text-xs text-[#666666]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="size-2 rounded-full bg-[#22c55e]" />
                  </div>
                  <p className="text-sm leading-relaxed text-[#f5f5f5]">{rec}</p>
                  <p className="mt-3 text-[10px] uppercase tracking-wider text-[#666666]">
                    Ask Zulo →
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <p className="mt-10 text-center text-[10px] leading-relaxed text-[#555555]">
          Informational only — not financial advice. DYOR. Burns are permanent. Zulo never asks for
          keys or signatures.
        </p>
      </main>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-[#666666]">{label}</span>
      <span className="text-right text-sm font-medium text-[#f5f5f5]">{value}</span>
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
    <div className="mt-1 space-y-4 rounded-xl border border-[#252525] bg-[#0d0d0d] p-4 text-left">
      <div>
        <p className="mb-1 text-[10px] uppercase tracking-wider text-[#666666]">Understanding</p>
        <p className="text-sm text-[#a3a3a3]">{response.understanding}</p>
      </div>
      <div>
        <p className="mb-1 text-[10px] uppercase tracking-wider text-[#666666]">Recommendation</p>
        {recs.length === 1 ? (
          <p className="text-sm text-[#f5f5f5]">{recs[0]}</p>
        ) : (
          <ul className="space-y-1 text-sm text-[#f5f5f5]">
            {recs.map((rec, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-[#666666]">•</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {response.reasoning ? (
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wider text-[#666666]">Reasoning</p>
          <p className="text-sm text-[#a3a3a3]">{response.reasoning}</p>
        </div>
      ) : null}
      {response.nextSteps?.length > 0 ? (
        <div>
          <p className="mb-2 text-[10px] uppercase tracking-wider text-[#666666]">Next steps</p>
          <div className="space-y-2">
            {response.nextSteps.map((step, i) => (
              <div key={i} className="flex gap-2 text-sm">
                <span className="text-[#22c55e]">→</span>
                <span className="text-[#f5f5f5]">{step}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {response.sources && response.sources.length > 0 ? (
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wider text-[#666666]">Sources</p>
          <ul className="space-y-1 font-mono text-[11px] text-[#666666]">
            {response.sources.map((s, i) => (
              <li key={i} className="break-all">
                {/^https?:\/\//i.test(s) ? (
                  <a
                    href={s}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#a3a3a3] hover:underline"
                  >
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
      <div className="flex items-center gap-3 border-t border-[#1f1f1f] pt-3">
        <span className="text-xs text-[#666666]">Confidence</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#1a1a1a]">
          <div
            className="h-full rounded-full bg-[#22c55e]"
            style={{ width: `${confidence}%` }}
          />
        </div>
        <span className="text-xs text-[#666666]">{confidence}%</span>
      </div>
    </div>
  )
}
