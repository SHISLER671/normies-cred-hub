import { NextRequest, NextResponse } from "next/server"
import { isAddress } from "viem"
import { enrichToolsWithWalletAccess } from "@/lib/erc8257/access-check"
import { getCachedRegistryTools } from "@/lib/erc8257/cache"
import type { Erc8257Chain } from "@/lib/erc8257/types"
import { ERC8257_SUPPORTED_CHAINS } from "@/lib/erc8257/constants"
import { checkRateLimit } from "@/lib/ratelimit"

function parseChains(param: string | null): Erc8257Chain[] | undefined {
  if (!param) return undefined
  const chains = param
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter((c): c is Erc8257Chain =>
      ERC8257_SUPPORTED_CHAINS.includes(c as Erc8257Chain),
    )
  return chains.length ? chains : undefined
}

export async function GET(req: NextRequest) {
  const rl = await checkRateLimit(req, "erc8257-tools", 30, 60)
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    )
  }

  const { searchParams } = new URL(req.url)
  const chainFilter = parseChains(searchParams.get("chain"))
  const tags = searchParams.get("tags")?.split(",").map((t) => t.trim()).filter(Boolean)
  const limit = Math.min(Number(searchParams.get("limit") || "0") || 0, 250) || undefined
  const walletParam = searchParams.get("wallet")?.trim()
  const wallet = walletParam && isAddress(walletParam) ? walletParam : undefined

  try {
    const { tools, cached, fetchedAt } = await getCachedRegistryTools()

    let filtered = tools
    if (chainFilter?.length) {
      filtered = filtered.filter((t) => chainFilter.includes(t.chain))
    }
    if (tags?.length) {
      const normalized = tags.map((t) => t.toLowerCase())
      filtered = filtered.filter((t) =>
        t.tags.some((tag) => normalized.includes(tag.toLowerCase())),
      )
    }
    if (limit) {
      filtered = filtered.slice(0, limit)
    }

    const enriched = await enrichToolsWithWalletAccess(filtered, wallet, {
      maxChecks: wallet ? 80 : 0,
    })

    return NextResponse.json({
      tools: enriched,
      meta: {
        total: enriched.length,
        cached,
        fetchedAt,
        chains: ERC8257_SUPPORTED_CHAINS,
        walletChecked: wallet ?? null,
      },
    })
  } catch (err) {
    console.error("[erc8257/tools] discovery failed:", err)
    return NextResponse.json(
      { error: "Failed to discover ERC-8257 tools" },
      { status: 502 },
    )
  }
}