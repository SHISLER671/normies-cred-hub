// Pure; no imports, so it is safe anywhere and testable without the "@/" alias.

/**
 * Wallet in, reputation numbers out. Ethos profiles carry an X handle, display name, avatar and bio: those would link a
 * wallet to a person or a social profile, which NCH never does (AGENTS.md), so they are dropped here, server-side.
 * The profile link points at the address, not the handle.
 */
export function publicReputationOnly(raw: unknown, address: string) {
  if (!raw || typeof raw !== "object") return null
  const u = raw as Record<string, unknown>
  const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d)
  const link = `https://app.ethos.network/profile/${address}`
  return {
    id: num(u.id),
    profileId: typeof u.profileId === "number" ? u.profileId : null,
    displayName: null,
    username: null,
    avatarUrl: null,
    description: null,
    score: num(u.score),
    status: typeof u.status === "string" ? u.status : "",
    userkeys: [],
    xpTotal: num(u.xpTotal),
    xpStreakDays: num(u.xpStreakDays),
    influenceFactor: num(u.influenceFactor),
    influenceFactorPercentile: num(u.influenceFactorPercentile),
    humanVerificationStatus: null,
    validatorNftCount: num(u.validatorNftCount),
    links: { profile: link, scoreBreakdown: link },
    stats: u.stats && typeof u.stats === "object" ? u.stats : {},
  }
}
