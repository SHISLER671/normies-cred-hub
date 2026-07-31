// Strict input validation for Zulo payment / A2A payloads.
// Lightweight Zod-compatible surface (no client fs); uses Zod when available.

import { z } from "zod"

import { ZULO_SERVICE_PRICES } from "@/lib/agent-recommendations/constants"

/** Max AP amount accepted in a single payment verification request. */
export const MAX_PAYMENT_AP = BigInt(10_000)

/** Services that may appear on paid A2A calls. */
export const VALID_SERVICES = [
  "pulse-analysis",
  "strategy",
  "urgent",
  "burn-efficiency",
  "market-sentinel",
  "canvas-preview",
  "holder-chat",
  "gacha-raffle",
] as const

export type ValidService = (typeof VALID_SERVICES)[number]

export const txHashSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, "txHash must be 0x + 64 hex chars")

export const amountSchema = z
  .union([z.string(), z.number(), z.bigint()])
  .transform((v) => {
    if (typeof v === "bigint") return v
    if (typeof v === "number") {
      if (!Number.isFinite(v) || !Number.isInteger(v)) {
        throw new Error("amount must be a positive integer")
      }
      return BigInt(v)
    }
    if (!/^\d+$/.test(v.trim())) throw new Error("amount must be a positive integer string")
    return BigInt(v.trim())
  })
  .refine((n) => n > BigInt(0), { message: "amount must be positive" })
  .refine((n) => n <= MAX_PAYMENT_AP, {
    message: `amount exceeds MAX_PAYMENT (${MAX_PAYMENT_AP})`,
  })

export const serviceSchema = z.enum(VALID_SERVICES)

/** EIP-191 / compact 65-byte sig as 0x + 130 hex. */
export const signatureSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{130}$/, "signature must be 0x + 130 hex chars (65 bytes)")

/** Client timestamp must be within ±60s of server time (seconds or ms). */
export const timestampSchema = z.union([z.number(), z.string()]).transform((v, ctx) => {
  const n = typeof v === "number" ? v : Number(v)
  if (!Number.isFinite(n)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "timestamp invalid" })
    return z.NEVER
  }
  const ms = n < 1e12 ? n * 1000 : n
  const skew = Math.abs(Date.now() - ms)
  if (skew > 60_000) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "timestamp outside 60s window",
    })
    return z.NEVER
  }
  return ms
})

export const walletSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "wallet must be 0x + 40 hex chars")

export const paymentVerifySchema = z.object({
  txHash: txHashSchema,
  amount: amountSchema,
  service: serviceSchema,
  from: walletSchema.optional(),
  signature: signatureSchema.optional(),
  timestamp: timestampSchema.optional(),
})

export const askBodySchema = z.object({
  userQuery: z.string().min(1).max(1000),
  normieId: z.number().int().min(0).max(9999).optional(),
  userWallet: walletSchema.optional(),
  userEns: z.string().max(128).optional(),
  service: serviceSchema.optional().default("holder-chat"),
  txHash: txHashSchema.optional(),
  sessionHistory: z
    .array(
      z.object({
        userMessage: z.string().max(1000),
        zuloResponse: z.string().max(4000),
      }),
    )
    .max(10)
    .optional(),
})

/** Intent tags for Path Board ranking (closed set). */
export const intentTagSchema = z.enum([
  "pulse",
  "burn",
  "market",
  "canvas",
  "identity",
  "access",
  "strategy",
])

/**
 * POST /api/zulo/paths — intent → ranked paths.
 * At least one of intent | intentTag required.
 */
export const pathRankBodySchema = z
  .object({
    intent: z.string().max(200).optional(),
    intentTag: intentTagSchema.optional(),
    tokenId: z.number().int().min(0).max(9999).optional(),
    wallet: walletSchema.optional(),
    limit: z.number().int().min(3).max(5).optional().default(5),
  })
  .superRefine((val, ctx) => {
    const hasIntent = typeof val.intent === "string" && val.intent.trim().length > 0
    const hasTag = val.intentTag != null
    if (!hasIntent && !hasTag) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide intent (short text) or intentTag (chip)",
        path: ["intent"],
      })
    }
  })

export const securityReportSchema = z.object({
  summary: z.string().min(10).max(2000),
  severity: z.enum(["sev1", "sev2", "sev3", "unknown"]).optional().default("unknown"),
  contact: z.string().email().optional().or(z.literal("")),
  details: z.string().max(10_000).optional(),
  /** Optional PoC URL — no executable payloads */
  referenceUrl: z.string().url().max(500).optional(),
})

export type PaymentVerifyInput = z.infer<typeof paymentVerifySchema>
export type AskBodyInput = z.infer<typeof askBodySchema>
export type SecurityReportInput = z.infer<typeof securityReportSchema>
export type PathRankBodyInput = z.infer<typeof pathRankBodySchema>

export function servicePriceAp(service: ValidService): number {
  return ZULO_SERVICE_PRICES[service] ?? 0
}

/** Format Zod errors for API responses. */
export function formatZodError(err: z.ZodError): string {
  return err.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ")
}
