"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { tools, type Tool } from "@/lib/tools"
import type { RegistryTool } from "@/lib/erc8257/types"
import { accessBadgeClass, getAccessBadge } from "@/lib/erc8257/ui"
import { Loader2 } from "lucide-react"

type Tab = "normies" | "erc8257"

export function ToolsModal({
  isOpen,
  onClose,
  initialTab = "normies",
  walletAddress,
}: {
  isOpen: boolean
  onClose: () => void
  initialTab?: Tab
  walletAddress?: string
}) {
  const [search, setSearch] = useState("")
  const [sortBy, setSortBy] = useState<"name" | "category">("name")
  const [tab, setTab] = useState<Tab>("normies")
  const [registryTools, setRegistryTools] = useState<RegistryTool[]>([])
  const [registryLoading, setRegistryLoading] = useState(false)
  const [registryError, setRegistryError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setSearch("")
      setSortBy("name")
      setTab(initialTab)
    }
  }, [isOpen, initialTab])

  useEffect(() => {
    if (!isOpen) return

    let cancelled = false
    setRegistryLoading(true)
    setRegistryError(null)

    const walletQuery = walletAddress
      ? `?wallet=${encodeURIComponent(walletAddress)}`
      : ""
    fetch(`/api/erc8257/tools${walletQuery}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data: { tools: RegistryTool[] }) => {
        if (!cancelled) setRegistryTools(data.tools ?? [])
      })
      .catch(() => {
        if (!cancelled) setRegistryError("Could not load ERC-8257 tools.")
      })
      .finally(() => {
        if (!cancelled) setRegistryLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [isOpen, walletAddress])

  const filteredNormies = [...tools]
    .filter(
      (tool) =>
        tool.name.toLowerCase().includes(search.toLowerCase()) ||
        tool.description.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name)
      return a.category.localeCompare(b.category)
    })

  const filteredRegistry = [...registryTools]
    .filter(
      (tool) =>
        tool.name.toLowerCase().includes(search.toLowerCase()) ||
        tool.description.toLowerCase().includes(search.toLowerCase()) ||
        tool.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())),
    )
    .sort((a, b) => a.name.localeCompare(b.name))

  const count = tab === "normies" ? filteredNormies.length : filteredRegistry.length

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="!flex h-[min(90vh,720px)] max-h-[90vh] min-h-0 flex-col gap-0 overflow-hidden bg-popover p-0 sm:max-w-2xl max-md:h-[92dvh] max-md:max-h-[92dvh]">
        <DialogHeader className="shrink-0 space-y-1 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
          <DialogTitle className="pr-8">Browse Tools</DialogTitle>
          <DialogDescription className="text-left text-xs sm:text-sm">
            Normies ecosystem utilities plus live ERC-8257 agent tools from the on-chain registry.
            Gated tools show access requirements — no wallet pressure.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-3 sm:px-6 sm:py-4">
          <div className="mb-3 flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => setTab("normies")}
              className={`rounded-none border px-3 py-1.5 text-xs transition-colors ${
                tab === "normies"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-card"
              }`}
            >
              Normies Ecosystem
            </button>
            <button
              type="button"
              onClick={() => setTab("erc8257")}
              className={`rounded-none border px-3 py-1.5 text-xs transition-colors ${
                tab === "erc8257"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-card"
              }`}
            >
              ERC-8257 Agent Tools
            </button>
          </div>

          <div className="mb-3 flex shrink-0 flex-col gap-2 sm:mb-4 sm:flex-row sm:gap-3">
            <input
              type="text"
              placeholder="Search tools..."
              className="flex-1 rounded-none border border-border bg-card px-3 py-2.5 text-sm focus:border-primary/50 focus:outline-none sm:px-4"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {tab === "normies" ? (
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "name" | "category")}
                className="rounded-none border border-border bg-card px-3 py-2.5 text-sm focus:border-primary/50 focus:outline-none"
              >
                <option value="name">Alphabetical</option>
                <option value="category">Category</option>
              </select>
            ) : null}
          </div>

          <div className="mb-2 shrink-0 text-xs text-muted-foreground">{count} tools</div>

          <div className="modal-scroll-region custom-scroll pr-1">
            {tab === "normies" ? (
              <>
                {filteredNormies.length === 0 && (
                  <p className="text-sm text-muted-foreground">No tools match your search.</p>
                )}
                {filteredNormies.map((tool) => (
                  <NormiesToolCard key={tool.id} tool={tool} />
                ))}
              </>
            ) : (
              <>
                {registryLoading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Loading registry…
                  </div>
                )}
                {registryError && (
                  <p className="text-sm text-muted-foreground">{registryError}</p>
                )}
                {!registryLoading && !registryError && filteredRegistry.length === 0 && (
                  <p className="text-sm text-muted-foreground">No tools match your search.</p>
                )}
                {filteredRegistry.map((tool) => (
                  <RegistryToolCard key={`${tool.chain}-${tool.toolId}`} tool={tool} />
                ))}
              </>
            )}
          </div>

          <p className="mt-2 shrink-0 text-[10px] text-muted-foreground">
            {tab === "normies"
              ? "Curated Normies ecosystem tools. ERC-8257 tab lists on-chain registered agent endpoints."
              : "Discovered from ToolRegistry on Ethereum + Base via manifest URIs."}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function NormiesToolCard({ tool }: { tool: Tool }) {
  return (
    <div className="card group mb-3 rounded-none border border-border p-4 transition-all hover:border-primary/30 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold tracking-tight">{tool.name}</h3>
          <span className="mt-1.5 inline-block rounded-none bg-muted px-2 py-0.5 text-[10px] tracking-[1.5px] text-muted-foreground">
            {tool.category}
          </span>
        </div>
        <a
          href={tool.url}
          target="_blank"
          rel="noopener noreferrer"
          className="glow-primary shrink-0 rounded-none border border-border px-4 py-2 text-center text-sm transition-all hover:bg-primary hover:text-primary-foreground sm:mt-1 sm:py-1.5"
        >
          Visit →
        </a>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{tool.description}</p>
    </div>
  )
}

function RegistryToolCard({ tool }: { tool: RegistryTool }) {
  const badge = getAccessBadge(tool.access)
  const href = tool.endpoint || tool.openseaUrl

  return (
    <div className="card group mb-3 rounded-none border border-border p-4 transition-all hover:border-primary/30 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold tracking-tight">{tool.name}</h3>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <span
              className={`inline-block rounded-none border px-2 py-0.5 text-[10px] tracking-[1.5px] ${accessBadgeClass(badge.variant)}`}
            >
              {badge.label}
            </span>
            <span className="inline-block rounded-none bg-muted px-2 py-0.5 text-[10px] tracking-[1.5px] text-muted-foreground">
              Tool #{tool.toolId} · {tool.chain}
            </span>
          </div>
        </div>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="glow-primary shrink-0 rounded-none border border-border px-4 py-2 text-center text-sm transition-all hover:bg-primary hover:text-primary-foreground sm:mt-1 sm:py-1.5"
          >
            Open →
          </a>
        ) : null}
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {tool.description || "No description."}
      </p>
      <p className="mt-2 text-xs text-muted-foreground/90">{tool.access.accessNote}</p>
      {tool.tags.length > 0 ? (
        <p className="mt-2 text-[10px] text-muted-foreground">
          Tags: {tool.tags.join(", ")}
        </p>
      ) : null}
    </div>
  )
}