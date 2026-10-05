// One shared, cached read of the Normies contract status for everything on the server (the /burn advisor and Ask).
import { loadBurnContractStatus } from "./contract-state"
import { ttl } from "./ttl"

/** The contract status changes rarely (the API itself caches it for 5 minutes), so 30 s is plenty; a failed read is never kept. */
export const cachedContractStatus = ttl(30_000, async () => {
  const s = await loadBurnContractStatus()
  if (!s) throw new Error("contract status unavailable")
  return s
})
