// POST /api/zulo/payments/verify — 7-step payment verification endpoint.

import { NextRequest, NextResponse } from "next/server"

import { enforceDualRateLimit } from "@/lib/middleware/rateLimit"
import { verifyPayment7Step } from "@/lib/payments/verify"
import { appendSecurityEvent } from "@/lib/security/audit"
import {
  formatZodError,
  paymentVerifySchema,
  servicePriceAp,
} from "@/lib/validation/schemas"

export const dynamic = "force-dynamic"
export const maxDuration = 30

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const rl = await enforceDualRateLimit(req, "payment", { body })
  if (!rl.ok) return rl.response

  const parsed = paymentVerifySchema.safeParse(body)
  if (!parsed.success) {
    await appendSecurityEvent({
      type: "VALIDATION_FAIL",
      detail: formatZodError(parsed.error),
      txHash: typeof (body as { txHash?: string })?.txHash === "string"
        ? (body as { txHash: string }).txHash
        : undefined,
    })
    return NextResponse.json(
      { error: formatZodError(parsed.error), code: "validation" },
      { status: 400 },
    )
  }

  const data = parsed.data
  const expected =
    Number(data.amount) > 0
      ? Number(data.amount)
      : servicePriceAp(data.service)

  const result = await verifyPayment7Step({
    txHash: data.txHash,
    expectedAmountAp: expected,
    service: data.service,
    caller: data.from,
  })

  return NextResponse.json(result, {
    status: result.verified ? 200 : 402,
  })
}
