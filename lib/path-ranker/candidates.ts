// Build a small candidate pool — not a full tools catalog.

import {
  CRED_HUB_PULSE,
  ZULO_IDENTITY,
  getAllZuloSkills,
} from "@/lib/agent-recommendations"
import { COMMUNITY_TOOLS } from "@/lib/agent-recommendations/communityTools"
import {
  scoreToolForAgent,
  type ZuloToolContext,
} from "@/lib/erc8257/context"
import type { RegistryTool } from "@/lib/erc8257/types"
import { tools as normiesTools, type Tool } from "@/lib/tools"
import {
  rankNormiesTools,
  scoreNormiesToolForAgent,
} from "@/lib/zulo/recommendations"

import { tagsForSkill } from "./intents"
import type {
  IntentTag,
  PathCandidate,
  PathNextStep,
  ParsedIntent,
} from "./types"
import type { AccessStatus } from "./types"

const APP_ORIGIN = "https://normiescredhub.vercel.app"

function nextStepForSkill(
  skillId: string,
  chip: string,
  prompt: string,
  tokenId?: number,
): PathNextStep {
  if (skillId === "pulse-analysis") {
    if (tokenId != null) {
      const path = `/api/agent/${tokenId}/pulse`
      return {
        label: `GET Pulse for #${tokenId}`,
        href: path,
        method: "GET",
        endpoint: `${APP_ORIGIN}${path}`,
        executable: true,
      }
    }
    return {
      label: "POST CredHub Pulse",
      href: "/api/agent",
      method: "POST",
      endpoint: `${APP_ORIGIN}/api/agent`,
      inputSchema: {
        type: "object",
        required: ["tokenId"],
        properties: { tokenId: { type: "integer", minimum: 0, maximum: 9999 } },
      },
      executable: true,
    }
  }

  const intentTag = tagsForSkill(skillId as Parameters<typeof tagsForSkill>[0])[0]
  const body: Record<string, unknown> = {
    intent: prompt,
  }
  if (intentTag) body.intentTag = intentTag
  if (tokenId != null) body.tokenId = tokenId

  return {
    label: `POST Paths · ${chip}`,
    href: `/paths?skill=${skillId}`,
    method: "POST",
    endpoint: `${APP_ORIGIN}/api/zulo/paths`,
    body,
    executable: true,
  }
}

const SKIP_SKILL_IDS = new Set(["holder-chat"])

/** Map Normies tool category/id → intent tags */
function tagsForNormiesTool(tool: Tool): IntentTag[] {
  const cat = tool.category.toLowerCase()
  const id = tool.id.toLowerCase()
  const tags: IntentTag[] = []

  if (cat === "canvas" || id === "canvas" || id === "normifier") tags.push("canvas")
  if (cat === "identity" || id === "lab") tags.push("identity", "pulse")
  if (cat === "reputation" || id === "ethos") tags.push("pulse", "identity")
  if (cat === "analytics" || id === "rarity") tags.push("market", "burn")
  if (cat === "marketplace" || id === "opensea") tags.push("market")
  if (cat === "pvp" || id === "arena") tags.push("strategy") // knowledge only — Zulo does not play
  if (cat === "utility" || cat === "development") tags.push("strategy", "access")
  if (tags.length === 0) tags.push("strategy")
  return tags
}

function tagsForRegistryTool(tool: RegistryTool): IntentTag[] {
  const tags = new Set<IntentTag>()
  const lower = tool.tags.map((t) => t.toLowerCase())
  const blob = `${tool.name} ${tool.description} ${lower.join(" ")}`.toLowerCase()

  if (
    lower.some((t) => ["reputation", "trust", "erc8004", "agent"].includes(t)) ||
    blob.includes("pulse") ||
    tool.toolId === CRED_HUB_PULSE.toolId
  ) {
    tags.add("pulse")
    tags.add("identity")
  }
  if (lower.some((t) => ["canvas", "image", "generator", "nft"].includes(t))) {
    tags.add("canvas")
  }
  if (blob.includes("burn") || blob.includes("market")) {
    tags.add(blob.includes("burn") ? "burn" : "market")
  }
  if (tool.access.openAccess === false) tags.add("access")
  if (tags.size === 0) tags.add("strategy")
  return [...tags]
}

function mapRegistryAccess(tool: RegistryTool): {
  status: AccessStatus
  note: string
} {
  if (tool.access.openAccess) {
    return { status: "open", note: tool.access.accessNote || "Open access" }
  }
  if (tool.access.accessGranted === true) {
    return {
      status: "granted",
      note: tool.access.accessNote || "Access granted for connected wallet",
    }
  }
  if (tool.access.accessGranted === false) {
    return {
      status: "gated",
      note: tool.access.accessNote || "Gated for this wallet",
    }
  }
  return {
    status: "unknown",
    note: tool.access.accessNote || "Access not checked (connect wallet)",
  }
}

/**
 * Zulo skills as first-class path candidates.
 * Excludes holder-chat (chat is frozen / not a path).
 */
export function candidatesFromSkills(
  intent: ParsedIntent,
  tokenId?: number,
): PathCandidate[] {
  const out: PathCandidate[] = []

  for (const skill of getAllZuloSkills()) {
    if (SKIP_SKILL_IDS.has(skill.id)) continue
    if (skill.status === "planned") continue

    const tags = tagsForSkill(skill.id)
    const pulseAffinity =
      skill.id === "pulse-analysis"
        ? 50
        : tags.includes(intent.primary)
          ? 35
          : 15

    out.push({
      pathId: `skill:${skill.id}`,
      kind: "zulo-skill",
      title: skill.name,
      description: skill.description,
      publisher: {
        name: ZULO_IDENTITY.name,
        agentId: ZULO_IDENTITY.agentId,
        tokenId: ZULO_IDENTITY.tokenId,
      },
      tags,
      keywords: [...skill.triggers, skill.chip, skill.name],
      access: {
        status: "open",
        note: "Free web path · A2A payment planned",
      },
      nextStep: nextStepForSkill(
        skill.id,
        skill.chip,
        skill.prompt,
        tokenId,
      ),
      pulseAffinity,
      skillId: skill.id,
    })
  }

  return out
}

/** Official Normies tools — capped, intent-filtered. */
export function candidatesFromNormiesTools(
  ctx: ZuloToolContext | undefined,
  intent: ParsedIntent,
  cap = 8,
): PathCandidate[] {
  const ranked = rankNormiesTools(ctx, 12)
  const pool = ranked.length > 0 ? ranked : normiesTools

  const mapped: PathCandidate[] = pool.map((tool) => {
    const tags = tagsForNormiesTool(tool)
    const affinity = scoreNormiesToolForAgent(tool, ctx)
    return {
      pathId: `normies:${tool.id}`,
      kind: "normies-tool" as const,
      title: tool.name,
      description: tool.description,
      publisher: { name: "Normies" },
      tags,
      keywords: [tool.name, tool.category, tool.description.slice(0, 80)],
      access: {
        status: "open" as const,
        note: "Official Normies surface (open web)",
      },
      nextStep: {
        label: `Open ${tool.name} (web)`,
        href: tool.url,
        method: "link" as const,
        executable: false,
      },
      pulseAffinity: affinity,
      category: tool.category,
    }
  })

  // Prefer intent overlap; keep some diversity
  const primary = intent.primary
  const sorted = [...mapped].sort((a, b) => {
    const aHit = a.tags.includes(primary) ? 1 : 0
    const bHit = b.tags.includes(primary) ? 1 : 0
    if (bHit !== aHit) return bHit - aHit
    return b.pulseAffinity - a.pulseAffinity
  })

  return sorted.slice(0, cap)
}

/** ERC-8257 registry tools — already access-enriched by prepareZuloRegistryTools. */
export function candidatesFromRegistryTools(
  tools: RegistryTool[],
  ctx: ZuloToolContext | undefined,
  intent: ParsedIntent,
  cap = 12,
): PathCandidate[] {
  const mapped = tools.map((tool) => {
    const access = mapRegistryAccess(tool)
    const tags = tagsForRegistryTool(tool)
    const affinity = scoreToolForAgent(tool, ctx)
    return {
      pathId: `registry:${tool.chain}:${tool.toolId}`,
      kind: "erc8257-tool" as const,
      title: tool.name,
      description: tool.description,
      publisher: {
        name: "ERC-8257 registry",
      },
      tags,
      keywords: [tool.name, ...tool.tags, tool.description.slice(0, 60)],
      access,
      nextStep: {
        label:
          tool.toolId === CRED_HUB_PULSE.toolId
            ? `POST CredHub Pulse (Tool #${tool.toolId})`
            : tool.endpoint
              ? `POST Tool #${tool.toolId}`
              : `Open Tool #${tool.toolId}`,
        href: tool.endpoint || tool.openseaUrl,
        method: tool.endpoint ? ("POST" as const) : ("link" as const),
        endpoint: tool.endpoint || undefined,
        toolId: tool.toolId,
        chain: tool.chain,
        inputSchema: tool.endpoint
          ? {
              type: "object",
              description: "See the tool manifest inputs at the metadata URI",
            }
          : undefined,
        body:
          tool.toolId === CRED_HUB_PULSE.toolId && ctx?.tokenId != null
            ? { tokenId: ctx.tokenId }
            : undefined,
        executable: Boolean(tool.endpoint),
      },
      pulseAffinity: affinity,
    }
  })

  const primary = intent.primary
  mapped.sort((a, b) => {
    const aHit = a.tags.includes(primary) ? 1 : 0
    const bHit = b.tags.includes(primary) ? 1 : 0
    if (bHit !== aHit) return bHit - aHit
    // Prefer accessible tools when intent is access
    if (intent.tags.includes("access")) {
      const aAcc = a.access.status === "granted" || a.access.status === "open" ? 1 : 0
      const bAcc = b.access.status === "granted" || b.access.status === "open" ? 1 : 0
      if (bAcc !== aAcc) return bAcc - aAcc
    }
    return b.pulseAffinity - a.pulseAffinity
  })

  return mapped.slice(0, cap)
}

/** Community tools only on keyword/intent hit — max 2. */
export function candidatesFromCommunity(
  intent: ParsedIntent,
  max = 2,
): PathCandidate[] {
  const q = intent.raw.toLowerCase()
  const scored = COMMUNITY_TOOLS.map((tool) => {
    let s = 0
    const kws = tool.keywords ?? []
    for (const kw of kws) {
      if (q.includes(kw.toLowerCase())) s += 3
    }
    // Tag-ish heuristics
    const name = tool.name.toLowerCase()
    if (intent.tags.includes("burn") && name.includes("burn")) s += 5
    if (intent.tags.includes("canvas") && name.includes("canvas")) s += 4
    if (intent.tags.includes("market") && (name.includes("rarity") || name.includes("burn")))
      s += 2
    for (const word of q.split(/\s+/).filter((w) => w.length > 3)) {
      if (name.includes(word) || tool.description.toLowerCase().includes(word)) s += 1
    }
    return { tool, s }
  })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, max)

  return scored.map(({ tool }) => {
    const tags: IntentTag[] = []
    const name = tool.name.toLowerCase()
    if (name.includes("burn")) tags.push("burn", "market")
    if (name.includes("canvas")) tags.push("canvas")
    if (name.includes("rarity")) tags.push("market")
    if (tags.length === 0) tags.push(...intent.tags.slice(0, 1), "strategy")

    return {
      pathId: `community:${slug(tool.name)}`,
      kind: "community-tool" as const,
      title: tool.name,
      description: tool.description,
      publisher: { name: "Community" },
      tags,
      keywords: [...(tool.keywords ?? []), tool.name],
      access: {
        status: "open" as const,
        note: "Community tool — open web",
      },
      nextStep: {
        label: `Open ${tool.name} (web)`,
        href: tool.url,
        method: "link" as const,
        executable: false,
      },
      pulseAffinity: 10,
    }
  })
}

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48)
}

/**
 * Merge candidate lists with stable dedupe by pathId.
 */
export function mergeCandidates(...lists: PathCandidate[][]): PathCandidate[] {
  const seen = new Set<string>()
  const out: PathCandidate[] = []
  for (const list of lists) {
    for (const c of list) {
      if (seen.has(c.pathId)) continue
      seen.add(c.pathId)
      out.push(c)
    }
  }
  return out
}
