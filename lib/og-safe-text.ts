/**
 * Text that is safe to put into a `next/og` ImageResponse. Agent names are set by their owners (untrusted), and
 * Next.js < 16.3.6 had a remote-code-execution bug when untrusted text reached ImageResponse (CVE-2026-94545 /
 * GHSA-vcvr-r3jv-pc5j). Upgrading Next is the fix; this keeps untrusted text harmless until then and afterwards:
 * letters, digits, spaces and a few plain punctuation marks only, length-capped. Pure, unit-tested.
 */
export function ogSafeText(raw: string | null | undefined, max = 32): string {
  const s = String(raw ?? "")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N} #.,'!?&-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s
}
