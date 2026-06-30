"use client"

import { useEffect, useState } from "react"
import type { RegistryTool } from "@/lib/erc8257/types"
import { accessBadgeClass, getAccessBadge } from "@/lib/erc8257/ui"
import { ExternalLink, Loader2 } from "lucide-react"

type ToolsResponse = {
  tools: RegistryTool[]
  meta?: { total: number; cached: boolean; fetchedAt: string }
}

export function Erc8257RegistryPanel({
  onBrowseAll,
}: {
  onBrowseAll?: () => void
}) {
  const [tools, setTools] = useState<RegistryTool[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetch("/api/erc8257/tools?limit=80")
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<ToolsResponse>
      })
      .then((data) => {
        if (cancelled) return
        setTools(data.tools ?? [])
      })
      .catch(() => {
        if (!cancelled) setError("Could not load ERC-8257 registry tools.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading on-chain tool registry…
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-muted-foreground">{error}</p>
  }

  const mainnetCount = tools.filter((t) => t.chain === "mainnet").length
  const baseCount = tools.filter((t) => t.chain === "base").length
  const featured = tools
    .filter((t) => t.tags.some((tag) => ["normies", "reputation", "trust"].includes(tag.toLowerCase())))
    .slice(0, 4)
  const preview = featured.length > 0 ? featured : tools.slice(0, 4)

  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed text-muted-foreground">
        {tools.length} registered agent tools across Ethereum ({mainnetCount}) and Base ({baseCount}).
        Manifests are content-addressed; access rules are shown per tool.
      </p>

      <ul className="space-y-2">
        {preview.map((tool) => {
          const badge = getAccessBadge(tool.access)
          const href = tool.endpoint || tool.openseaUrl
          return (
            <li
              key={`${tool.chain}-${tool.toolId}`}
              className="rounded-none border border-border bg-card/50 px-3 py-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{tool.name}</span>
                <span
                  className={`rounded-none border px-1.5 py-0.5 text-[10px] tracking-wide ${accessBadgeClass(badge.variant)}`}
                >
                  {badge.label}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  #{tool.toolId} · {tool.chain}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                {tool.description || "No description."}
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground/80">
                {tool.access.accessNote}
              </p>
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  View tool <ExternalLink className="size-3" />
                </a>
              ) : null}
            </li>
          )
        })}
      </ul>

      {onBrowseAll ? (
        <button
          type="button"
          onClick={onBrowseAll}
          className="text-xs text-primary hover:underline"
        >
          Browse all tools →
        </button>
      ) : null}
    </div>
  )
}