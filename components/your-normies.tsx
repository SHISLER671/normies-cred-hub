"use client"

import { Badge } from "@/components/ui/badge"
import { SectionLabel } from "@/components/ui/section-label"
import { Skeleton } from "@/components/ui/skeleton"
import { normieImageUrl } from "@/lib/api/normies"
import { shortenAddress } from "@/lib/format"
import type { OwnedNormie } from "@/lib/types"
import { AlertTriangle } from "lucide-react"

type YourNormiesProps = {
  walletAddress?: string
  normies: OwnedNormie[]
  isLoading?: boolean
  isError?: boolean
  selectedTokenId?: number
  onSelect?: (tokenId: number) => void
}

function AwakenedBadge({ isAwakened }: { isAwakened: boolean }) {
  if (isAwakened) {
    return (
      <span className="inline-flex items-center border border-emerald-500/40 bg-emerald-500/10 px-2 py-px text-[10px] font-medium uppercase tracking-[1.5px] text-emerald-600 dark:text-emerald-400">
        Awakened
      </span>
    )
  }

  return (
    <span className="inline-flex items-center border border-border bg-muted/60 px-2 py-px text-[10px] font-medium uppercase tracking-[1.5px] text-muted-foreground">
      Not Awakened
    </span>
  )
}

function NormieCard({
  item,
  isSelected,
  onSelect,
}: {
  item: OwnedNormie
  isSelected?: boolean
  onSelect?: (tokenId: number) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(item.tokenId)}
      className={`flex w-[148px] shrink-0 flex-col gap-3 border bg-card p-3 text-left transition-colors rounded-none cursor-pointer ${
        isSelected
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/30 hover:bg-card-hover"
      }`}
      aria-label={`Load Normie #${item.tokenId}`}
      aria-pressed={isSelected}
    >
      <div className="mx-auto size-16 overflow-hidden border border-border bg-secondary/30 rounded-none">
        <img
          src={normieImageUrl(item.tokenId)}
          alt={`Normie #${item.tokenId}`}
          className="size-full pixel-frame"
          width={64}
          height={64}
        />
      </div>

      <div className="space-y-1.5 text-center w-full">
        <p className="font-mono text-sm font-medium">#{item.tokenId}</p>
        <p className="text-xs text-muted-foreground">{item.type}</p>
        <div className="flex justify-center">
          <AwakenedBadge isAwakened={item.isAwakened} />
        </div>
      </div>
    </button>
  )
}

function LoadingState() {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="flex w-[148px] shrink-0 flex-col gap-3 border border-border bg-card p-3 rounded-none"
        >
          <Skeleton className="mx-auto size-16" />
          <Skeleton className="mx-auto h-4 w-12" />
          <Skeleton className="mx-auto h-3 w-16" />
          <Skeleton className="mx-auto h-5 w-24" />
        </div>
      ))}
    </div>
  )
}

export function YourNormies({
  walletAddress,
  normies,
  isLoading,
  isError,
  selectedTokenId,
  onSelect,
}: YourNormiesProps) {
  if (isError) {
    return (
      <section className="rounded-none border border-destructive/30 bg-card/70 p-5">
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="size-4 shrink-0" />
          <p className="text-sm">Could not load your Normies. Try again in a moment.</p>
        </div>
      </section>
    )
  }

  if (!isLoading && normies.length === 0) {
    return (
      <section className="rounded-none border border-border bg-card/50 p-6 text-center">
        <SectionLabel className="mb-2">Your Normies</SectionLabel>
        <p className="text-sm text-muted-foreground text-pretty">
          No Normies found for this wallet yet. Search any token ID above, or mint one at{" "}
          <a
            href="https://normies.art"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            normies.art
          </a>
          .
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-none border border-border bg-card/70 p-5">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <SectionLabel>Your Normies</SectionLabel>
        {walletAddress && (
          <Badge variant="outline" className="w-fit font-mono normal-case tracking-normal">
            {shortenAddress(walletAddress, 4)}
          </Badge>
        )}
      </div>

      {isLoading ? (
        <LoadingState />
      ) : (
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
          {normies.map((item) => (
            <NormieCard
              key={item.tokenId}
              item={item}
              isSelected={selectedTokenId === item.tokenId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </section>
  )
}