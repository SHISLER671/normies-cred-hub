// The retention cron's logic, kept apart from the route so it can be tested without Next or Supabase.
// It runs on its own schedule: an earlier version rode on canvas-watch and was skipped whenever that scan failed first.

import { isAuthorizedCron } from "@/lib/security/cron-auth"

export type RetentionCronResult = { status: 200 | 401 | 503; body: { ok: boolean; error?: string } }

export async function runRetentionCron(
  authorization: string | null,
  cronSecret: string | undefined,
  purge: () => Promise<{ ok: boolean }>,
): Promise<RetentionCronResult> {
  if (!isAuthorizedCron(authorization, cronSecret)) return { status: 401, body: { ok: false, error: "Unauthorized" } }
  try {
    const r = await purge()
    // 503 when a delete failed or the database isn't configured, so the cron run shows as failed in Vercel.
    return r.ok ? { status: 200, body: { ok: true } } : { status: 503, body: { ok: false, error: "Retention delete did not complete" } }
  } catch {
    return { status: 503, body: { ok: false, error: "Retention delete did not complete" } }
  }
}
