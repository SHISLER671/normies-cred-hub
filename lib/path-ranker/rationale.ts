// Short Zulo path-finder notes — personality only, never multi-turn chat.

import type { PathCandidate, ParsedIntent, RankPathsSubject } from "./types"

/**
 * Template-based rationale (1–2 sentences). No LLM.
 */
export function buildRationale(
  candidate: PathCandidate,
  intent: ParsedIntent,
  subject: RankPathsSubject,
): string {
  const pulseNote =
    subject.pulse_level != null
      ? `Pulse ${subject.pulse_level}/5${subject.status ? ` (${subject.status})` : ""}`
      : "no Normie loaded for Pulse weighting"

  if (candidate.kind === "zulo-skill") {
    return skillRationale(candidate, intent, pulseNote, subject)
  }
  if (candidate.kind === "erc8257-tool") {
    return registryRationale(candidate, intent, pulseNote)
  }
  if (candidate.kind === "community-tool") {
    return `Community path: ${candidate.title} fits “${intent.primary}”. I don't run it — I point you at the scoop (${pulseNote}).`
  }
  // normies-tool
  return normiesRationale(candidate, intent, pulseNote, subject)
}

function skillRationale(
  candidate: PathCandidate,
  intent: ParsedIntent,
  pulseNote: string,
  subject: RankPathsSubject,
): string {
  switch (candidate.skillId) {
    case "pulse-analysis":
      return subject.gaps?.length
        ? `CredHub Pulse is the spine here — gaps still open: ${subject.gaps.slice(0, 2).join("; ")}. Run PULSE analysis before chasing side quests.`
        : `Your ${pulseNote} is the cleanest read on trust state. Start with PULSE analysis, then pick a specialist path.`
    case "burn-efficiency":
      return `Burn efficiency ranks fodder by expected AP per ETH — not vibes. Intent “${intent.primary}” → scan before you light anything up (${pulseNote}).`
    case "market-sentinel":
      return `Market Sentinel frames floor Δ, burn spikes, and whale clusters. Use it when “${intent.primary}” means don't fly blind on listings.`
    case "canvas-evolution":
      return `Canvas Evolution prices transforms and flags PROCEED/MODIFY/ABANDON. Right move when the job is pixels, not chatter (${pulseNote}).`
    case "gacha-raffle":
      return `Gacha/raffle EV is partial until live feeds are dense — treat it as a framing pass, not a guarantee.`
    default:
      return `Zulo path: ${candidate.title} for intent “${intent.primary}” (${pulseNote}). Matcher only — not a chat thread.`
  }
}

function registryRationale(
  candidate: PathCandidate,
  intent: ParsedIntent,
  pulseNote: string,
): string {
  const access = candidate.access.status
  const accessBit =
    access === "granted"
      ? "Your wallet clears access."
      : access === "gated"
        ? "Gated for this wallet — still listed so you know the wall."
        : access === "open"
          ? "Open access."
          : "Access not fully checked."

  return `Registry tool “${candidate.title}” ranks for “${intent.primary}” against ${pulseNote}. ${accessBit}`
}

function normiesRationale(
  candidate: PathCandidate,
  intent: ParsedIntent,
  pulseNote: string,
  subject: RankPathsSubject,
): string {
  if (candidate.tags.includes("identity") && (subject.gaps?.length ?? 0) > 0) {
    return `${candidate.title} closes identity/trust gaps on ${pulseNote}. Official surface — not a random catalog pick.`
  }
  if (candidate.tags.includes("canvas")) {
    return `${candidate.title} is the on-chain pixel path for “${intent.primary}”. I match; you act (${pulseNote}).`
  }
  return `${candidate.title} is the highest-signal official path for “${intent.primary}” given ${pulseNote}.`
}

export const PATH_FINDER_NOTE =
  "Zulo ranks free, tryable Normies paths from Pulse, access, and intent — high-signal concierge for burns, tools, and Canvas. Rate 👍/👎 to credit the path and Zulo #32626."
