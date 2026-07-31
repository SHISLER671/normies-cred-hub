/**
 * Product surface feature flags.
 * Mirrors the envBool pattern used in lib/payments/config.ts.
 */

function envTruthy(name: string): boolean {
  const raw = process.env[name]?.trim().toLowerCase()
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on"
}

/**
 * Path Board primary surface (intent → ranked paths).
 * Client-visible so homepage CTAs and headers can branch.
 * Default: OFF until rollout.
 */
export function isPathBoardEnabled(): boolean {
  return envTruthy("NEXT_PUBLIC_PATH_BOARD")
}
