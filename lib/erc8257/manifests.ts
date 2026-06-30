import { computeManifestHash } from "@opensea/tool-sdk"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"

export type ToolManifest = {
  name?: string
  description?: string
  tags?: string[]
  endpoint?: string
  access?: {
    logic?: "AND" | "OR"
    requirements?: Array<{ label?: string; description?: string }>
  }
}

export type ResolvedManifest = {
  manifest: ToolManifest | null
  manifestVerified: boolean
  name: string
  description: string
  tags: string[]
  endpoint: string
  manifestAccessLabels: string[]
  manifestDeclaresGating: boolean
}

const ZERO_HASH =
  "0x0000000000000000000000000000000000000000000000000000000000000000"

export async function fetchAndVerifyManifest(
  metadataURI: string,
  onchainHash: string,
): Promise<ResolvedManifest> {
  const fallback: ResolvedManifest = {
    manifest: null,
    manifestVerified: false,
    name: "Unknown Tool",
    description: "",
    tags: [],
    endpoint: "",
    manifestAccessLabels: [],
    manifestDeclaresGating: false,
  }

  if (!metadataURI?.startsWith("https://")) return fallback

  try {
    const res = await fetchWithTimeout(metadataURI, {}, 5_000)
    if (!res.ok) return fallback

    const manifest = (await res.json()) as ToolManifest
    const computed = computeManifestHash(manifest)
    const manifestVerified =
      onchainHash.toLowerCase() !== ZERO_HASH &&
      computed.toLowerCase() === onchainHash.toLowerCase()

    const manifestAccessLabels = (manifest.access?.requirements ?? [])
      .map((r) => r.label || r.description)
      .filter((s): s is string => !!s)

    const manifestDeclaresGating = manifestAccessLabels.length > 0

    return {
      manifest,
      manifestVerified,
      name: manifest.name?.trim() || fallback.name,
      description: manifest.description?.trim() || "",
      tags: Array.isArray(manifest.tags)
        ? manifest.tags.filter((t) => typeof t === "string")
        : [],
      endpoint: manifest.endpoint?.trim() || "",
      manifestAccessLabels,
      manifestDeclaresGating,
    }
  } catch {
    return fallback
  }
}