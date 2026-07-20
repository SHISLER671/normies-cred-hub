"use client"

import { useCallback, useRef, useState } from "react"
import { useAccount } from "wagmi"
import { Loader2, RefreshCw, Send } from "lucide-react"

import { ConnectWallet } from "@/components/connect-wallet"
import { ResponseCard } from "@/components/agent-recommendations/response-card"
import { Button } from "@/components/ui/button"
import { useEnsName } from "@/hooks/use-ens-name"
import {
  MAX_SESSION_HISTORY,
  MAX_USER_QUERY_CHARS,
  ZULO_IDENTITY,
  type ZuloResponse,
} from "@/lib/agent-recommendations"
import { cn } from "@/lib/utils"

type ChatTurn = {
  id: string
  userMessage: string
  response?: ZuloResponse
  error?: string
}

const EXAMPLE_PROMPTS = [
  "How can I earn with my Normie?",
  "How do I grow collection utility?",
  "What should a Level 1 agent focus on?",
] as const

function formatZuloReplyForHistory(response: ZuloResponse): string {
  const rec = Array.isArray(response.recommendation)
    ? response.recommendation.join(" · ")
    : response.recommendation
  return `${response.understanding}\n${rec}\n${response.reasoning}`
}

export function ZuloAgentChat({ className }: { className?: string }) {
  const { address, isConnected } = useAccount()
  const { data: ensName } = useEnsName(address)

  const [input, setInput] = useState("")
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      }
    })
  }, [])

  const clearChat = useCallback(() => {
    setTurns([])
    setInput("")
    setError(null)
    setIsLoading(false)
  }, [])

  async function sendQuery(raw: string) {
    const userQuery = raw.trim()
    if (!userQuery || isLoading) return

    if (userQuery.length > MAX_USER_QUERY_CHARS) {
      setError(`Messages are limited to ${MAX_USER_QUERY_CHARS} characters.`)
      return
    }

    setError(null)
    setIsLoading(true)
    setInput("")

    const turnId = crypto.randomUUID()
    setTurns((prev) => [...prev, { id: turnId, userMessage: userQuery }])
    scrollToBottom()

    const sessionHistory = turns
      .filter((t) => t.response)
      .slice(-MAX_SESSION_HISTORY)
      .map((t) => ({
        userMessage: t.userMessage,
        zuloResponse: formatZuloReplyForHistory(t.response!),
      }))

    try {
      const res = await fetch("/api/agent-recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userQuery,
          normieId: ZULO_IDENTITY.tokenId,
          sessionHistory,
          userWallet: address,
          userEns: ensName || undefined,
        }),
      })

      const data = (await res.json().catch(() => ({}))) as ZuloResponse & {
        error?: string
      }

      if (!res.ok) {
        const msg = data.error || `Request failed (${res.status})`
        setTurns((prev) =>
          prev.map((t) => (t.id === turnId ? { ...t, error: msg } : t)),
        )
        setError(msg)
        return
      }

      if (!data.understanding && !data.recommendation) {
        const msg = "Zulo returned an empty response. Please try again."
        setTurns((prev) =>
          prev.map((t) => (t.id === turnId ? { ...t, error: msg } : t)),
        )
        setError(msg)
        return
      }

      const response: ZuloResponse = {
        understanding: data.understanding || "I received your request.",
        recommendation: data.recommendation ?? "No specific recommendation available.",
        reasoning: data.reasoning || "Based on current context.",
        nextSteps: Array.isArray(data.nextSteps) ? data.nextSteps : [],
        confidence: data.confidence,
      }

      setTurns((prev) =>
        prev.map((t) => (t.id === turnId ? { ...t, response } : t)),
      )
    } catch {
      const msg = "Could not reach Zulo. Check your connection and try again."
      setTurns((prev) =>
        prev.map((t) => (t.id === turnId ? { ...t, error: msg } : t)),
      )
      setError(msg)
    } finally {
      setIsLoading(false)
      scrollToBottom()
    }
  }

  const canSend =
    !isLoading && input.trim().length > 0 && input.length <= MAX_USER_QUERY_CHARS

  return (
    <div
      className={cn(
        "flex flex-col rounded-none border border-border bg-card/60",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center border border-border bg-muted/40 font-mono text-sm text-foreground">
            Z
          </div>
          <div>
            <h2 className="font-heading text-lg tracking-[-0.8px] text-foreground">
              Zulo
            </h2>
            <p className="font-mono text-[11px] text-muted-foreground">
              Agent #{ZULO_IDENTITY.agentId} · {ZULO_IDENTITY.ens} · Normie #
              {ZULO_IDENTITY.tokenId}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={clearChat}
          disabled={isLoading || turns.length === 0}
          className="shrink-0 gap-1.5 text-xs text-muted-foreground"
        >
          <RefreshCw className="size-3.5" />
          Clear
        </Button>
      </div>

      {/* Wallet hint */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/20 px-4 py-2.5 sm:px-5">
        {isConnected && address ? (
          <p className="font-mono text-[11px] text-muted-foreground">
            Context: {ensName || `${address.slice(0, 6)}…${address.slice(-4)}`}
          </p>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Connect wallet for personalized holdings context
          </p>
        )}
        {!isConnected ? <ConnectWallet /> : null}
      </div>

      {/* Stream */}
      <div
        ref={scrollRef}
        className="flex max-h-[min(60vh,520px)] min-h-[280px] flex-col gap-4 overflow-y-auto px-4 py-4 sm:px-5"
      >
        {turns.length === 0 ? (
          <div className="flex flex-1 flex-col justify-center gap-4 py-6">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Ah — splendid of you to drop by. I am Zulo, Agent #
              {ZULO_IDENTITY.agentId}. Ask about earning, growing your collection,
              or getting more utility from an awakened Normie. We shall keep it
              practical.
            </p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={isLoading}
                  onClick={() => sendQuery(prompt)}
                  className="border border-border bg-background px-3 py-1.5 text-left text-xs text-foreground transition-colors hover:border-muted-foreground/50 hover:bg-muted/30 disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {turns.map((turn) => (
          <div key={turn.id} className="space-y-3">
            <div className="ml-auto max-w-[90%] border border-border bg-muted/30 px-3 py-2 sm:max-w-[80%]">
              <p className="mb-1 text-[10px] font-medium uppercase tracking-[1.2px] text-muted-foreground">
                You
              </p>
              <p className="text-sm leading-relaxed text-foreground">
                {turn.userMessage}
              </p>
            </div>

            {turn.response ? <ResponseCard response={turn.response} /> : null}

            {turn.error ? (
              <div className="border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {turn.error}
              </div>
            ) : null}
          </div>
        ))}

        {isLoading ? (
          <div className="flex items-center gap-2 border border-border bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Zulo is thinking…
          </div>
        ) : null}
      </div>

      {/* Input */}
      <div className="space-y-2 border-t border-border px-4 py-4 sm:px-5">
        {error && turns.some((t) => t.error) ? null : error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : null}
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                if (canSend) void sendQuery(input)
              }
            }}
            placeholder="Ask Zulo anything…"
            rows={2}
            maxLength={MAX_USER_QUERY_CHARS}
            disabled={isLoading}
            className="min-h-[44px] flex-1 resize-none border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
          />
          <Button
            type="button"
            disabled={!canSend}
            onClick={() => void sendQuery(input)}
            className="shrink-0 gap-1.5 self-end"
          >
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Ask
          </Button>
        </div>
        <p className="font-mono text-[10px] text-muted-foreground">
          {input.length}/{MAX_USER_QUERY_CHARS} · session keeps last{" "}
          {MAX_SESSION_HISTORY} exchanges in this tab
        </p>
      </div>
    </div>
  )
}
