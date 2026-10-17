// Cron authorization. Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set on the project.
// The `x-vercel-cron` header is NOT proof: any client can send it. Only the bearer secret counts, compared in constant time.
import { timingSafeEqual } from "node:crypto"

export function isAuthorizedCron(authorization: string | null | undefined, cronSecret: string | null | undefined): boolean {
  const secret = cronSecret?.trim()
  if (!secret) return false
  const expected = Buffer.from(`Bearer ${secret}`)
  const got = Buffer.from(authorization ?? "")
  if (got.length !== expected.length) return false
  return timingSafeEqual(got, expected)
}
