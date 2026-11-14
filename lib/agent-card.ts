// Pulse check 2, "Has active agent card": actually read the card (docs/zulo/pulse-trust-fixes-spec.md, PR-3).
//
// The chain says where the agent's registration file is (agentURI on the ERC-8004 Identity Registry). The registration file
// lists the agent's services; the one named A2A points at the agent card. The check passes when that card answers 200 with
// JSON whose `name` is the Normie's agent name.
//
// What this proves: the card is PUBLISHED and names this agent. It does not prove the agent is online or answers messages
// (Normies' A2A transport isn't live yet). Copy says "Agent card published", never "agent online".
//
// Both URLs come from outside (whoever registered the agent chose them), so each is fetched only if its host is on the
// allowlist AND it passes the SSRF guard, with a time limit, a size cap and no redirects. Read-only: two GETs, no writes.

import { fetchWithTimeout } from "@/lib/fetch-with-timeout"
import { AGENT_CARD_HOST_ALLOWLIST, assertAllowlistedHttpsUrl, type LookupFn } from "@/lib/security/ssrf"

export const AGENT_CARD_TIMEOUT_MS = 5_000
export const AGENT_CARD_MAX_BYTES = 256 * 1024
/** Plain words for any surface that shows the check. Never "online": the card being published says nothing about that. */
export const AGENT_CARD_PASS_TEXT = "Agent card published"

export const AGENT_CARD_REASONS = [
  /** The agent has no registration on-chain, or no agent at all. */
  "not_registered",
  /** The registration file, or the card, couldn't be fetched or read. Unknown, not a finding: never cached. */
  "card_unreadable",
  /** The registration file or the card is on a host NCH doesn't fetch from. Nothing was requested. */
  "card_host_not_allowed",
  /** The registration file was read and lists no A2A service. */
  "card_not_listed",
  /** The card was read and its name is not the Normie's agent name. */
  "card_name_mismatch",
] as const
export type AgentCardReason = (typeof AGENT_CARD_REASONS)[number]

/** Added to the Pulse response as `agent_card` (additive). */
export type AgentCardCheck = {
  /** True when the card itself was fetched and read. False when it couldn't be, or was never requested. */
  checked: boolean
  /** True when "Has active agent card" is granted: the card answered 200 with JSON naming this agent. */
  passed: boolean
  /** sha256 of the card body as served (hex), so anyone can tell when the card changes. Null when the card wasn't read. */
  card_hash: string | null
  /** Why it didn't pass. Absent when it passed. */
  reason?: AgentCardReason
  as_of: string
}

export type AgentCardDeps = {
  /** GET a URL that has already passed the allowlist and the SSRF guard. Throws when it can't be fetched. */
  fetchText: (url: URL) => Promise<{ status: number; text: string }>
  /** DNS lookup for the SSRF guard (injectable for tests). Undefined = the real resolver. */
  lookup?: LookupFn
  allowedHosts: readonly string[]
  now: () => Date
}

async function fetchText(url: URL): Promise<{ status: number; text: string }> {
  // redirect: "error": a redirect could leave the allowlisted host, so it counts as "couldn't read".
  const res = await fetchWithTimeout(url, { headers: { Accept: "application/json" }, redirect: "error", cache: "no-store" }, AGENT_CARD_TIMEOUT_MS)
  if (Number(res.headers.get("content-length") || 0) > AGENT_CARD_MAX_BYTES) throw new Error("response too large")
  const text = await res.text()
  if (text.length > AGENT_CARD_MAX_BYTES) throw new Error("response too large")
  return { status: res.status, text }
}

export const DEFAULT_AGENT_CARD_DEPS: AgentCardDeps = {
  fetchText,
  allowedHosts: AGENT_CARD_HOST_ALLOWLIST,
  now: () => new Date(),
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("")
}

function parseObject(text: string): Record<string, unknown> | null {
  try {
    const v: unknown = JSON.parse(text)
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/**
 * The A2A service's endpoint in an ERC-8004 registration file, or null when there is none. `services` is the current
 * field name; older registration files call the same list `endpoints`. The first entry named A2A (any letter case) wins.
 */
export function a2aEndpoint(registration: unknown): string | null {
  if (!registration || typeof registration !== "object") return null
  const r = registration as Record<string, unknown>
  const list = Array.isArray(r.services) ? r.services : Array.isArray(r.endpoints) ? r.endpoints : []
  for (const entry of list) {
    if (!entry || typeof entry !== "object") continue
    const e = entry as Record<string, unknown>
    if (typeof e.name === "string" && e.name.trim().toLowerCase() === "a2a" && typeof e.endpoint === "string" && e.endpoint.trim()) {
      return e.endpoint.trim()
    }
  }
  return null
}

const sameName = (a: string, b: string) => a.normalize("NFC").trim().toLowerCase() === b.normalize("NFC").trim().toLowerCase()

/** One guarded GET: "blocked" (never requested), "failed" (couldn't read), or the 200 body. */
async function guardedGet(raw: string, deps: AgentCardDeps): Promise<{ kind: "ok"; text: string } | { kind: "blocked" } | { kind: "failed" }> {
  let host: string
  try {
    host = new URL(raw).hostname.toLowerCase()
  } catch {
    return { kind: "blocked" }
  }
  // Off the list is a finding (nothing is requested). On the list but failing the guard (DNS down, odd port) is "couldn't read".
  if (!deps.allowedHosts.some((h) => h.toLowerCase() === host)) return { kind: "blocked" }
  try {
    const url = await assertAllowlistedHttpsUrl(raw, deps.allowedHosts, deps.lookup)
    const res = await deps.fetchText(url)
    return res.status === 200 ? { kind: "ok", text: res.text } : { kind: "failed" }
  } catch {
    return { kind: "failed" }
  }
}

/**
 * Run the check. `agentURI` is what the Identity Registry returned for this agent (null = no registration);
 * `uriReadable: false` means that read itself failed. `agentName` is the Normie's agent name from the official API.
 * Never throws.
 */
export async function checkAgentCard(
  input: { agentURI: string | null; uriReadable: boolean; agentName: string | null | undefined },
  deps: AgentCardDeps = DEFAULT_AGENT_CARD_DEPS,
): Promise<AgentCardCheck> {
  const as_of = deps.now().toISOString()
  const no = (reason: AgentCardReason): AgentCardCheck => ({ checked: false, passed: false, card_hash: null, reason, as_of })

  if (!input.uriReadable) return no("card_unreadable")
  const uri = input.agentURI?.trim()
  if (!uri) return no("not_registered")

  const registration = await guardedGet(uri, deps)
  if (registration.kind === "blocked") return no("card_host_not_allowed")
  if (registration.kind === "failed") return no("card_unreadable")
  const file = parseObject(registration.text)
  if (!file) return no("card_unreadable")
  const cardUrl = a2aEndpoint(file)
  if (!cardUrl) return no("card_not_listed")

  const card = await guardedGet(cardUrl, deps)
  if (card.kind === "blocked") return no("card_host_not_allowed")
  if (card.kind === "failed") return no("card_unreadable")
  const body = parseObject(card.text)
  if (!body) return no("card_unreadable")

  const card_hash = await sha256Hex(card.text)
  const name = typeof body.name === "string" ? body.name : ""
  const expected = input.agentName ?? ""
  if (!name.trim() || !expected.trim() || !sameName(name, expected)) {
    return { checked: true, passed: false, card_hash, reason: "card_name_mismatch", as_of }
  }
  return { checked: true, passed: true, card_hash, as_of }
}

/** True when the result is "couldn't read" rather than a finding. Such a result must not be cached. */
export function agentCardUnreadable(check: Pick<AgentCardCheck, "reason">): boolean {
  return check.reason === "card_unreadable"
}

/** A definite answer is kept for 5 minutes per server instance (the card rarely changes). "Couldn't read" is never kept. */
const CARD_TTL_MS = 5 * 60_000
const cardCache = new Map<string, { at: number; check: AgentCardCheck }>()

export async function checkAgentCardCached(
  input: { agentURI: string | null; uriReadable: boolean; agentName: string | null | undefined },
  deps: AgentCardDeps = DEFAULT_AGENT_CARD_DEPS,
): Promise<AgentCardCheck> {
  if (!input.uriReadable || !input.agentURI) return checkAgentCard(input, deps)
  const key = `${input.agentURI}\n${input.agentName ?? ""}`
  const hit = cardCache.get(key)
  if (hit && Date.now() - hit.at < CARD_TTL_MS) return hit.check
  const check = await checkAgentCard(input, deps)
  if (!agentCardUnreadable(check)) {
    if (cardCache.size > 5_000) cardCache.clear()
    cardCache.set(key, { at: Date.now(), check })
  }
  return check
}

/** Tests only: forget cached answers. */
export function __resetAgentCardCacheForTests(): void {
  cardCache.clear()
}
