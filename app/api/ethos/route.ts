import { ETHOS_API_BASE, ETHOS_CLIENT_HEADER } from "@/constants/contracts"
import { type NextRequest, NextResponse } from "next/server"
import { fetchWithTimeout, isTimeoutError } from "@/lib/fetch-with-timeout"
import { enforceDualRateLimit } from "@/lib/middleware/rateLimit"

/**
 * Read-only proxy for the public Ethos reputation API: wallet address → Ethos profile.
 * Forwards to POST /users/by/address. No wallet auth required.
 *
 * Address lookups only. The old username → wallet search was removed on purpose: NCH never maps people to wallets.
 */
export async function POST(req: NextRequest) {
  const rl = await enforceDualRateLimit(req, "default", { bucketPrefix: "ethos" })
  if (!rl.ok) return rl.response

  let address: unknown
  try {
    const body = (await req.json()) as { address?: unknown }
    address = body?.address
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (typeof address !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "A valid 0x address is required" }, { status: 400 })
  }

  try {
    const res = await fetchWithTimeout(
      `${ETHOS_API_BASE}/users/by/address`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Ethos-Client": ETHOS_CLIENT_HEADER,
        },
        body: JSON.stringify({ addresses: [address] }),
        next: { revalidate: 300 },
      },
      8_000,
    )

    if (!res.ok) {
      console.warn("[ethos] upstream", res.status)
      return NextResponse.json({ error: "Ethos is unavailable right now", user: null }, { status: 502 })
    }

    const arr = (await res.json()) as unknown[]
    const user = Array.isArray(arr) && arr.length > 0 ? arr[0] : null

    return NextResponse.json(
      { user },
      {
        headers: {
          // Per-wallet answer: cache in the browser only, not on the shared CDN.
          "Cache-Control": "private, max-age=300",
        },
      },
    )
  } catch (err) {
    console.error("[ethos]", err)
    return NextResponse.json(
      { error: isTimeoutError(err) ? "Ethos timed out" : "Failed to reach Ethos", user: null },
      { status: isTimeoutError(err) ? 504 : 502 },
    )
  }
}
