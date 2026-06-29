"use client"

import type { ReactNode } from "react"
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

const CARD_WIDTH = "w-[118px]"

function AwakenedBadge({ isAwakened }: { isAwakened: boolean }) {
  if (isAwakened) {
    return (
      <span className="inline-flex h-4 items-center rounded-none bg-emerald-500/15 px-1.5 text-[9px] font-medium uppercase tracking-[1px] text-emerald-600 dark:text-emerald-400">
        Awakened
      </span>
    )
  }

  return (
    <span className="inline-flex h-4 items-center rounded-none bg-muted px-1.5 text-[9px] font-medium uppercase tracking-[1px] text-muted-foreground">
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
      className={`relative ${CARD_WIDTH} shrink-0 snap-start flex flex-col gap-2 border border-border p-2 text-left transition-colors rounded-none cursor-pointer ${
        isSelected ? "bg-primary/[0.07]" : "bg-card/90 hover:bg-card-hover"
      }`}
      aria-label={`Load Normie #${item.tokenId}`}
      aria-pressed={isSelected}
    >
      {isSelected && (
        <span className="absolute inset-y-0 left-0 w-0.5 bg-primary" aria-hidden="true" />
      )}
      <div className="mx-auto size-12 overflow-hidden border border-border/80 bg-secondary/25 rounded-none">
        <img
          src={normieImageUrl(item.tokenId)}
          alt={`Normie #${item.tokenId}`}
          className="size-full pixel-frame"
          width={48}
          height={48}
        />
      </div>

      <div className="flex w-full flex-col items-center gap-1">
        <p className="font-mono text-xs font-semibold leading-none">#{item.tokenId}</p>
        <p className="text-[10px] leading-none text-muted-foreground">{item.type}</p>
        <AwakenedBadge isAwakened={item.isAwakened} />
      </div>
    </button>
  )
}

function NormieCardSkeleton() {
  return (
    <div
      className={`${CARD_WIDTH} shrink-0 snap-start flex flex-col gap-2 border border-border bg-card/90 p-2 rounded-none`}
    >
      <Skeleton className="mx-auto size-12" />
      <Skeleton className="mx-auto h-3 w-10" />
      <Skeleton className="mx-auto h-2.5 w-14" />
      <Skeleton className="mx-auto h-4 w-16" />
    </div>
  )
}

function NormieScrollList({ children }: { children: ReactNode }) {
  return (
    <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth pb-0.5 [scrollbar-width:thin]">
      {children}
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
      <section className="rounded-none border border-destructive/25 bg-card/60 px-4 py-3">
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="size-3.5 shrink-0" />
          <p className="text-sm">Could not load your Normies. Try again in a moment.</p>
        </div>
      </section>
    )
  }

  if (!isLoading && normies.length === 0) {
    return (
      <section className="rounded-none border border-border bg-card/50 px-4 py-4 text-center">
        <SectionLabel className="mb-1.5">Your Normies</SectionLabel>
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
    <section className="rounded-none border border-border bg-card/55 px-4 py-3">
      <div className="mb-2.5 flex items-center gap-2">
        <SectionLabel>Your Normies</SectionLabel>
        {walletAddress && (
          <span className="inline-flex h-5 items-center border border-border/70 bg-secondary/40 px-1.5 font-mono text-[10px] text-muted-foreground rounded-none">
            {shortenAddress(walletAddress, 4)}
          </span>
        )}
        {!isLoading && normies.length > 1 && (
          <span className="ml-auto text-[10px] tracking-[1px] text-muted-foreground/70">
            {normies.length} owned
          </span>
        )}
      </div>

      {isLoading ? (
        <NormieScrollList>
          {Array.from({ length: 3 }).map((_, i) => (
            <NormieCardSkeleton key={i} />
          ))}
        </NormieScrollList>
      ) : normies.length === 1 ? (
        <div className="flex">
          <NormieCard
            item={normies[0]}
            isSelected={selectedTokenId === normies[0].tokenId}
            onSelect={onSelect}
          />
        </div>
      ) : (
        <NormieScrollList>
          {normies.map((item) => (
            <NormieCard
              key={item.tokenId}
              item={item}
              isSelected={selectedTokenId === item.tokenId}
              onSelect={onSelect}
            />
          ))}
        </NormieScrollList>
      )}
    </section>
  )
}