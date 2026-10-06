// The one place NCH reads #PIXEL attached to Normies straight from the chain (NormiesCanvasStorageV2.attachedOf), so every page that
// prices or ranks Normies by their pixels sees the truth, not a cached API or OpenSea copy. Read-only; never throws.

import { parseAbi } from "viem"

import { NORMIES_CANVAS_STORAGE } from "@/constants/contracts"
import { publicClient } from "@/lib/viem-client"

const ABI = parseAbi(["function attachedOf(uint256 tokenId) view returns (uint256)"])

function within<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p.catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), ms))])
}

/** attachedOf for many tokens in one multicall. A token whose read failed maps to null (never a guessed number). */
export async function readAttached(ids: number[], timeoutMs = 6_000): Promise<Map<number, number | null>> {
  const out = new Map<number, number | null>(ids.map((id) => [id, null]))
  if (ids.length === 0) return out
  const res = await within(
    publicClient.multicall({
      allowFailure: true,
      contracts: ids.map((id) => ({ address: NORMIES_CANVAS_STORAGE, abi: ABI, functionName: "attachedOf" as const, args: [BigInt(id)] as const })),
    }),
    timeoutMs,
  )
  if (!res) return out
  res.forEach((r, i) => {
    if (r.status === "success" && typeof r.result === "bigint" && r.result <= BigInt(Number.MAX_SAFE_INTEGER)) out.set(ids[i], Number(r.result))
  })
  return out
}
