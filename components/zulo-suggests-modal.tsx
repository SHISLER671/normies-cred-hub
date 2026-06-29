"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { SectionLabel } from "@/components/ui/section-label"
import {
  buildHorizonInsights,
  getWelcomeMessage,
  type HorizonAgentContext,
  type HorizonChatMessage,
  ZULO_HORIZON_LIMITS,
} from "@/lib/zulo-horizon"
import { Loader2, RefreshCw, Send, Sparkles } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

function createSession() {
  const now = Date.now()
  return {
    sessionId: crypto.randomUUID(),
    sessionStartedAt: now,
    lastActivityAt: now,
  }
}

export function AgentHorizonModal({
  agentContext = null,
  open,
  onOpenChange,
}: {
  agentContext?: HorizonAgentContext | null
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [session, setSession] = useState(createSession)
  const [messages, setMessages] = useState<HorizonChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [limitReached, setLimitReached] = useState(false)
  const [userMessageCount, setUserMessageCount] = useState(0)
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const insights = useMemo(() => buildHorizonInsights(agentContext), [agentContext])

  const resetSession = useCallback(() => {
    setSession(createSession())
    setMessages([{ role: "assistant", content: getWelcomeMessage(agentContext) }])
    setInput("")
    setError(null)
    setLimitReached(false)
    setUserMessageCount(0)
    setIsLoading(false)
  }, [agentContext])

  useEffect(() => {
    if (open) {
      resetSession()
      const timer = window.setTimeout(() => inputRef.current?.focus(), 150)
      return () => window.clearTimeout(timer)
    }
  }, [open, resetSession])

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [messages, isLoading])

  const remainingUserMessages = ZULO_HORIZON_LIMITS.maxUserMessages - userMessageCount
  const canSend =
    !isLoading &&
    !limitReached &&
    input.trim().length > 0 &&
    input.length <= ZULO_HORIZON_LIMITS.maxInputChars

  async function sendMessage() {
    const trimmed = input.trim()
    if (!trimmed || isLoading || limitReached) return

    if (Date.now() - session.lastActivityAt > ZULO_HORIZON_LIMITS.sessionTimeoutMs) {
      setLimitReached(true)
      setError(
        "This chat session has timed out after 10 minutes of inactivity. Start a new chat to continue!",
      )
      return
    }

    if (trimmed.length > ZULO_HORIZON_LIMITS.maxInputChars) {
      setError(`Messages are limited to ${ZULO_HORIZON_LIMITS.maxInputChars} characters.`)
      return
    }

    const userMsg: HorizonChatMessage = { role: "user", content: trimmed }
    const nextHistory = [...messages, userMsg]

    setMessages(nextHistory)
    setInput("")
    setError(null)
    setIsLoading(true)

    try {
      const res = await fetch("/api/zulo-horizon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.sessionId,
          sessionStartedAt: session.sessionStartedAt,
          lastActivityAt: session.lastActivityAt,
          messages: messages,
          message: trimmed,
          agentContext,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        const code = data.code as string | undefined
        if (
          code === "SESSION_USER_LIMIT" ||
          code === "SESSION_MESSAGE_LIMIT" ||
          code === "SESSION_EXPIRED"
        ) {
          setLimitReached(true)
        }
        setError(data.error || "Something went wrong. Please try again.")
        setMessages(messages)
        return
      }

      setMessages([...nextHistory, { role: "assistant", content: data.reply }])
      setSession((s) => ({ ...s, lastActivityAt: Date.now() }))
      if (data.limits?.userMessages != null) {
        setUserMessageCount(data.limits.userMessages)
        if (data.limits.userMessages >= ZULO_HORIZON_LIMITS.maxUserMessages) {
          setLimitReached(true)
        }
      } else {
        setUserMessageCount((c) => c + 1)
      }
    } catch {
      setError("Could not reach Zulo. Check your connection and try again.")
      setMessages(messages)
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void sendMessage()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!flex h-[min(88vh,780px)] max-h-[88vh] min-h-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl max-md:h-[92dvh] max-md:max-h-[92dvh]">
        <DialogHeader className="shrink-0 space-y-0 border-b border-border px-4 py-3 sm:px-5 sm:py-3.5">
          <div className="flex items-center justify-between gap-3 pr-10">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Sparkles className="size-4 shrink-0 text-primary sm:size-5" />
              Zulo Horizon
            </DialogTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 shrink-0 rounded-none px-2.5 text-xs"
              onClick={resetSession}
              disabled={isLoading}
            >
              <RefreshCw className="mr-1 size-3" />
              New chat
            </Button>
          </div>
          <DialogDescription className="mt-1.5 text-left text-xs sm:text-sm">
            Insights first, then conversation — awakened Normie #7141, canvas purist.
          </DialogDescription>
        </DialogHeader>

        {/* Insights — capped height on small screens so chat input stays visible */}
        <section className="shrink-0 border-b border-border bg-card/30 px-4 py-3 sm:px-5 max-md:max-h-[26vh] max-md:overflow-y-auto">
          <SectionLabel className="mb-2 text-[10px] text-primary tracking-[2px] sm:text-xs">
            Zulo&apos;s Take
          </SectionLabel>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-2.5">
            {insights.map((insight) => (
              <div
                key={insight.label}
                className="rounded-none border border-border border-l-2 border-l-primary/45 bg-background/50 px-2.5 py-2 sm:px-3 sm:py-2.5"
              >
                <p className="text-[9px] font-medium uppercase tracking-[1.25px] text-primary sm:text-[10px]">
                  {insight.label}
                </p>
                <p className="mt-0.5 text-xs leading-snug text-foreground/90 text-pretty sm:mt-1 sm:text-[13px]">
                  {insight.text}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Chat — primary interactive area; input pinned to bottom */}
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-secondary/10">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/60 px-4 py-2 sm:px-5">
            <SectionLabel className="text-foreground tracking-[2px]">Talk to Zulo</SectionLabel>
            <p className="text-right text-[10px] tracking-[0.5px] text-muted-foreground">
              {remainingUserMessages > 0
                ? `${remainingUserMessages} left · ${ZULO_HORIZON_LIMITS.maxInputChars} char max · 10 min session`
                : "Session limit reached — start a new chat to continue"}
            </p>
          </div>

          <div
            ref={chatScrollRef}
            className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5 [scrollbar-width:thin]"
          >
            <div className="flex flex-col gap-3.5 sm:gap-4">
              {messages.map((msg, i) => (
                <ChatBubble key={`${msg.role}-${i}`} message={msg} />
              ))}
              {isLoading && (
                <div className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin text-primary" />
                  <span>Zulo is thinking…</span>
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 border-t border-border bg-popover">
            {error && (
              <div className="border-b border-destructive/20 bg-destructive/5 px-4 py-2 text-sm text-destructive sm:px-5">
                {error}
              </div>
            )}

            <div className="px-4 py-3.5 sm:px-5 sm:py-4">
              <div className="flex items-end gap-3">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) =>
                    setInput(e.target.value.slice(0, ZULO_HORIZON_LIMITS.maxInputChars))
                  }
                  onKeyDown={handleKeyDown}
                  placeholder={
                    limitReached
                      ? "Start a new chat to continue…"
                      : "Ask Zulo anything about Normies, Canvas, or your agent…"
                  }
                  disabled={isLoading || limitReached}
                  rows={2}
                  className="min-h-[52px] max-h-[120px] flex-1 resize-none rounded-none border border-border bg-background px-3.5 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Message to Zulo"
                />
                <Button
                  type="button"
                  size="icon"
                  onClick={() => void sendMessage()}
                  disabled={!canSend}
                  className="size-11 shrink-0 rounded-none"
                  aria-label="Send message"
                >
                  <Send className="size-4" />
                </Button>
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Enter to send · Shift+Enter for newline</span>
                <span>
                  {input.length}/{ZULO_HORIZON_LIMITS.maxInputChars}
                </span>
              </div>
            </div>
          </div>
        </section>
      </DialogContent>
    </Dialog>
  )
}

function ChatBubble({ message }: { message: HorizonChatMessage }) {
  const isUser = message.role === "user"

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[min(92%,28rem)] px-3.5 py-3 text-sm leading-relaxed rounded-none sm:px-4 ${
          isUser
            ? "border border-primary/30 bg-primary/10 text-foreground"
            : "border border-border bg-card text-foreground"
        }`}
      >
        {!isUser && (
          <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[1.5px] text-primary">
            Zulo
          </span>
        )}
        <p className="whitespace-pre-wrap text-pretty">{message.content}</p>
      </div>
    </div>
  )
}