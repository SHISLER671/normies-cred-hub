"use client"

import { SectionLabel } from "@/components/ui/section-label"
import { Skeleton } from "@/components/ui/skeleton"
import type { ChatRatingsSummary } from "@/lib/chat-ratings/load"
import { etherscanAddress, shortenAddress } from "@/lib/format"
import { cn } from "@/lib/utils"
import { MessageCircleQuestion, Star } from "lucide-react"

function Stars({ value }: { value: number }) {
  // value is 0–5; render five stars with a partial fill on the last one.
  return (
    <div className="flex items-center gap-0.5" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i))
        return (
          <span key={i} className="relative inline-block size-4">
            <Star className="absolute inset-0 size-4 text-muted-foreground/40" />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className="chat-star-fill size-4 fill-primary text-primary" />
            </span>
          </span>
        )
      })}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-border/60 px-2 py-1.5 text-center">
      <div className="font-heading text-base tabular-nums">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  )
}

/**
 * Hive chat ratings for one agent, ranked signal over noise.
 * Plain words on purpose: this is how good chats were, not a trust score.
 */
export function ChatRatingsCard({
  summary,
  isLoading,
  isError,
  agentId,
}: {
  summary?: ChatRatingsSummary | null
  isLoading?: boolean
  isError?: boolean
  agentId?: string | number
}) {
  if (!agentId) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <MessageCircleQuestion className="size-4" aria-hidden />
        <span>Awaken this Normie to collect chat ratings.</span>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    )
  }

  if (isError || !summary || !summary.available) {
    return (
      <div className="text-sm text-muted-foreground">
        Chat ratings are unavailable right now. The on-chain registry didn&apos;t answer — try again shortly.
      </div>
    )
  }

  const { raw, weighting } = summary
  const progress = Math.min(raw.unique_raters, summary.min_unique_raters)

  return (
    <div className="space-y-3">
      {raw.ratings === 0 ? (
        <div>
          <div className="font-medium">No chat ratings yet</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Ratings appear here after people chat with Agent #{agentId} in Hive chat on normies.art and rate it.
          </p>
        </div>
      ) : summary.ranked && summary.score != null && summary.stars != null ? (
        <div className="flex items-end justify-between gap-3">
          <div>
            <SectionLabel>CHAT RATING</SectionLabel>
            <div className="mt-1 flex items-center gap-2">
              <Stars value={summary.stars} />
              <span className="font-heading text-xl tabular-nums">{summary.stars.toFixed(1)}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="chat-score font-heading text-xl tabular-nums text-primary">{summary.score}</div>
            <div className="text-[11px] text-muted-foreground">out of 100</div>
          </div>
        </div>
      ) : (
        <div>
          <SectionLabel>CHAT RATING</SectionLabel>
          <div className="mt-1 font-medium">Not enough ratings yet</div>
          <p className="mt-1 text-xs text-muted-foreground">
            A score shows once {summary.min_unique_raters} different wallets have rated. So far: {raw.unique_raters}.
          </p>
          <div className="mt-2 h-1.5 w-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={summary.min_unique_raters} aria-valuenow={progress}>
            <div
              className="h-full bg-primary transition-[width] duration-700"
              style={{ width: `${(progress / summary.min_unique_raters) * 100}%` }}
            />
          </div>
        </div>
      )}

      {raw.ratings > 0 && (
        <>
          <div className="grid grid-cols-3 gap-1.5">
            <Stat label="ratings" value={raw.ratings} />
            <Stat label="wallets" value={raw.unique_raters} />
            <Stat label="plain average" value={raw.average ?? "—"} />
          </div>

          <div className="flex flex-wrap gap-1.5 text-[11px]">
            <span className={cn("border px-1.5 py-px", weighting.holders > 0 ? "chat-holders border-primary/40 text-primary" : "border-border text-muted-foreground")}>
              {weighting.holders} holder{weighting.holders === 1 ? "" : "s"}
              {weighting.delegated_holders > 0 ? ` (${weighting.delegated_holders} via delegate.xyz)` : ""}
            </span>
            <span className="border border-border px-1.5 py-px text-muted-foreground">
              {weighting.fresh_wallets} new wallet{weighting.fresh_wallets === 1 ? "" : "s"}
            </span>
            <span className="border border-border px-1.5 py-px text-muted-foreground">
              {weighting.repeat_raters} repeat rater{weighting.repeat_raters === 1 ? "" : "s"}
            </span>
            {!summary.recency_available && (
              <span className="border border-border px-1.5 py-px text-muted-foreground">dates unavailable</span>
            )}
          </div>
        </>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
        How good chats with this agent were — not a trust score for its owner. Each wallet counts once (its ratings are
        averaged); Normie holders (including vaults delegated through delegate.xyz) and established wallets count more, and recent chats count more than old ones.
      </p>

      <div className="text-xs text-muted-foreground">
        Registry:{" "}
        <a
          href={etherscanAddress(summary.source.registry)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono underline hover:text-primary"
        >
          {shortenAddress(summary.source.registry)}
        </a>{" "}
        · tag <span className="font-mono">{summary.source.tag2}</span>
      </div>
    </div>
  )
}
