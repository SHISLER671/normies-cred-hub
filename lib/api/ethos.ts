import { getEthosLevel } from "@/lib/ethos-levels"
import type { EthosScoreResult, EthosUser } from "@/lib/types"

/**
 * Client-side Ethos helper. Calls our own `/api/ethos` proxy route which
 * forwards to POST https://api.ethos.network/api/v2/users/by/address.
 * Public lookup — no wallet auth required.
 */
export async function fetchEthosScore(address: string): Promise<EthosScoreResult> {
  const res = await fetch("/api/ethos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address }),
  })

  if (!res.ok) {
    throw new Error(`Ethos API error (${res.status})`)
  }

  const data = (await res.json()) as { user: EthosUser | null }
  const user = data.user

  return {
    address,
    user,
    found: !!user,
    level: user ? getEthosLevel(user.score) : null,
  }
}

export async function fetchEthosByUsername(username: string): Promise<EthosUser | null> {
  const res = await fetch("/api/ethos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  })

  if (!res.ok) {
    throw new Error(`Ethos API error (${res.status})`)
  }

  const data = (await res.json()) as { user: EthosUser | null }
  return data.user || null
}
