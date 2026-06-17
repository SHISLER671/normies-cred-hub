import { ETHOS_API_BASE, ETHOS_CLIENT_HEADER } from "@/constants/contracts"
import { type NextRequest, NextResponse } from "next/server"

/**
 * Read-only proxy for the public Ethos reputation API.
 * Forwards to POST /users/by/address. No wallet auth required.
 */
export async function POST(req: NextRequest) {
  let address: string | undefined
  try {
    const body = await req.json()
    address = body?.address
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!address || typeof address !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "A valid 0x address is required" }, { status: 400 })
  }

  try {
    const res = await fetch(`${ETHOS_API_BASE}/users/by/address`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Ethos-Client": ETHOS_CLIENT_HEADER,
      },
      body: JSON.stringify({ addresses: [address] }),
      next: { revalidate: 300 },
    })

    if (!res.ok) {
      return NextResponse.json(
        { error: `Ethos upstream returned ${res.status}`, user: null },
        { status: res.status },
      )
    }

    const arr = (await res.json()) as unknown[]
    const user = Array.isArray(arr) && arr.length > 0 ? arr[0] : null

    return NextResponse.json(
      { user },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    )
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to reach Ethos API", detail: String(err), user: null },
      { status: 502 },
    )
  }
}
