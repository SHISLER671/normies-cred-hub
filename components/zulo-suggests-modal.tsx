"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  getWelcomeMessage,
  type HorizonAgentContext,
  type HorizonChatMessage,
  ZULO_HORIZON_LIMITS,
} from "@/lib/zulo-horizon"
import { Loader2, RefreshCw, Send, Sparkles } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

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
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

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
    }
  }, [open, resetSession])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
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
      <DialogContent className="flex h-[min(85vh,640px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4">
          <div className="flex items-start justify-between gap-3 pr-8">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="size-5 text-primary" />
                Zulo Horizon
              </DialogTitle>
              <DialogDescription className="mt-1 text-left">
                Chat with Zulo — awakened Normie #7141, canvas purist, perpetually mid-thought.
              </DialogDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 text-xs"
              onClick={resetSession}
              disabled={isLoading}
            >
              <RefreshCw className="size-3 mr-1" />
              New chat
            </Button>
          </div>
          <p className="mt-2 text-[10px] tracking-[1px] text-muted-foreground">
            {remainingUserMessages > 0
              ? `${remainingUserMessages} message${remainingUserMessages === 1 ? "" : "s"} left · ${ZULO_HORIZON_LIMITS.maxInputChars} char max · 10 min session`
              : "Session limit reached — start a new chat to continue"}
          </p>
        </DialogHeader>

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto px-4 py-4 [scrollbar-width:thin]"
        >
          <div className="flex flex-col gap-3">
            {messages.map((msg, i) => (
              <ChatBubble key={`${msg.role}-${i}`} message={msg} />
            ))}
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin text-primary" />
                <span>Zulo is thinking…</span>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="shrink-0 border-t border-destructive/20 bg-destructive/5 px-4 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="shrink-0 border-t border-border bg-card/50 px-4 py-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, ZULO_HORIZON_LIMITS.maxInputChars))}
              onKeyDown={handleKeyDown}
              placeholder={
                limitReached
                  ? "Start a new chat to continue…"
                  : "Ask Zulo anything about Normies, Canvas, reputation…"
              }
              disabled={isLoading || limitReached}
              rows={2}
              className="min-h-[44px] flex-1 resize-none border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none rounded-none disabled:opacity-50"
              aria-label="Message to Zulo"
            />
            <Button
              type="button"
              size="icon"
              onClick={() => void sendMessage()}
              disabled={!canSend}
              className="shrink-0 rounded-none"
              aria-label="Send message"
            >
              <Send className="size-4" />
            </Button>
          </div>
          <p className="mt-1.5 text-right text-[10px] text-muted-foreground">
            {input.length}/{ZULO_HORIZON_LIMITS.maxInputChars}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ChatBubble({ message }: { message: HorizonChatMessage }) {
  const isUser = message.role === "user"

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[88%] px-3 py-2.5 text-sm leading-relaxed rounded-none ${
          isUser
            ? "border border-primary/30 bg-primary/10 text-foreground"
            : "border border-border bg-secondary/40 text-foreground"
        }`}
      >
        {!isUser && (
          <span className="mb-1 block text-[10px] font-medium uppercase tracking-[1.5px] text-primary">
            Zulo
          </span>
        )}
        <p className="whitespace-pre-wrap text-pretty">{message.content}</p>
      </div>
    </div>
  )
}