import type { NextRequest } from "next/server"

import type { AgentPulseResponse, AgentPulseResult } from "@/lib/api/agent-pulse"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"

/** Base URL for server-side calls to this app's public pulse API. */
export function resolvePulseBaseUrl(req?: NextRequest): string {
  if (req) {
    return req.nextUrl.origin
  }

  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  )
}

/**
 * Fetch agent pulse over HTTP — same contract as GET /api/agent/{tokenId}/pulse
 * and the Normies Cred Pulse ERC-8257 tool (Tool ID 53).
 */
export async function fetchAgentPulse(
  tokenId: number,
  options?: { req?: NextRequest; timeoutMs?: number },
): Promise<AgentPulseResult> {
  const base = resolvePulseBaseUrl(options?.req)
  const url = `${base}/api/agent/${tokenId}/pulse`

  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      },
      options?.timeoutMs ?? 8_000,
    )

    if (!res.ok) {
      const body = await res.json().catch(() => null)
      const message =
        body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string"
          ? (body as { error: string }).error
          : `Pulse request failed (${res.status})`

      return {
        ok: false,
        error: message,
        status: res.status === 400 ? 400 : 404,
      }
    }

    const data = (await res.json()) as AgentPulseResponse
    return { ok: true, data }
  } catch {
    return { ok: false, error: "Pulse service unavailable", status: 404 }
  }
}