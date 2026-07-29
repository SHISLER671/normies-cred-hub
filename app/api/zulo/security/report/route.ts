// POST /api/zulo/security/report — vulnerability disclosure intake.

import { NextRequest, NextResponse } from "next/server"

import { enforceDualRateLimit } from "@/lib/middleware/rateLimit"
import { appendSecurityEvent } from "@/lib/security/audit"
import {
  formatZodError,
  securityReportSchema,
} from "@/lib/validation/schemas"

export const dynamic = "force-dynamic"
export const maxDuration = 15

export async function POST(req: NextRequest) {
  const rl = await enforceDualRateLimit(req, "security", {
    bucketPrefix: "zulo-sec-report",
  })
  if (!rl.ok) return rl.response

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = securityReportSchema.safeParse(body)
  if (!parsed.success) {
    await appendSecurityEvent({
      type: "VALIDATION_FAIL",
      detail: formatZodError(parsed.error),
    })
    return NextResponse.json(
      { error: formatZodError(parsed.error), code: "validation" },
      { status: 400 },
    )
  }

  const report = parsed.data
  const event = await appendSecurityEvent({
    type: "SECURITY_REPORT",
    caller: report.contact || "anonymous",
    detail: `[${report.severity}] ${report.summary.slice(0, 500)}`,
  })

  // Never echo full details publicly; acknowledge with event id only
  return NextResponse.json({
    ok: true,
    message:
      "Report received. Operators will review. Thank you for responsible disclosure.",
    referenceId: event.id,
    severity: report.severity,
  })
}
