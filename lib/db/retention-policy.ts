// Pure retention rules (no database): tested on their own. Keep in step with /privacy.

/** Move ratings (👍/👎, intent, optional unverified wallet) are deleted after this many days. */
export const RATINGS_RETENTION_DAYS = 180

/** ISO timestamp: rows created before it are past retention. */
export function retentionCutoff(now: Date, days: number): string {
  if (!Number.isInteger(days) || days < 1) throw new Error("retention days must be a positive whole number")
  return new Date(now.getTime() - days * 86_400_000).toISOString()
}
