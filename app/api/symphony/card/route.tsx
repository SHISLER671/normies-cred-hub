// GET /api/symphony/card?ids=7141,1&block=N — the Pixel Symphony share card (1200×630 PNG): the Normies' faces, key and
// tempo, and the song drawn as a 1-bit pixel score. It is the link preview for /symphony share links and the ⤓ PNG
// download. Read-only; everything is recomputed from the official API (at the pinned block, if given). Nothing stored.

import { ImageResponse } from "next/og"
import { type NextRequest, NextResponse } from "next/server"

import { svgDataUri, faceSvg } from "@/lib/record-card/og-art"
import { composeScore } from "@/lib/symphony/compose"
import { viewGrid } from "@/lib/symphony/grid"
import { loadVoice } from "@/lib/symphony/load"
import { parseBlock, parseIds } from "@/lib/symphony/pin"
import { rollSvg } from "@/lib/symphony/roll"
import { checkRateLimit } from "@/lib/ratelimit"

const BG = "#1a1b1c"
const INK = "#e3e5e4"
const MUTED = "#939494"
const LINE = "#38393a"

export async function GET(req: NextRequest) {
  // Link previews are served from the CDN cache; this only limits uncached renders (up to 12 Normies × 5 reads each).
  const rl = await checkRateLimit(req, "symphony-card", 30, 60)
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } })
  }
  const ids = parseIds(req.nextUrl.searchParams.get("ids"))
  const block = parseBlock(req.nextUrl.searchParams.get("block"))
  const list = ids.length ? ids : [7141]
  const loaded = await Promise.all(list.map((id) => loadVoice(id, block).catch(() => null)))
  const voices = loaded.filter((v) => v !== null)
  // Anything missing (outage or burned) gets a short cache, so a bad render isn't pinned on the CDN for a day.
  const complete = voices.length === list.length
  const score = voices.length ? composeScore(voices) : null
  const title = voices.length === 1 ? voices[0].name.toUpperCase() : `${voices.length} NORMIES`

  const res = new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: BG, color: INK, padding: "40px 48px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 20, letterSpacing: 5 }}>
          <div style={{ display: "flex", padding: "8px 14px", border: `2px solid ${LINE}`, color: MUTED }}>NCH · PIXEL SYMPHONY</div>
          <div style={{ display: "flex", color: MUTED }}>{block ? `BLOCK ${block}` : "LIVE PIXELS"}</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 28, marginTop: 26 }}>
          <div style={{ display: "flex", gap: 8 }}>
            {voices.slice(0, 6).map((v) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={v.tokenId} src={svgDataUri(faceSvg(viewGrid(v.pixels).pixels))} width={voices.length === 1 ? 150 : 84} height={voices.length === 1 ? 150 : 84} alt="" />
            ))}
            {voices.length > 6 && (
              <div style={{ display: "flex", width: 84, height: 84, alignItems: "center", justifyContent: "center", border: `2px solid ${LINE}`, color: MUTED, fontSize: 28 }}>
                +{voices.length - 6}
              </div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", fontSize: title.length > 12 ? 52 : 72, fontWeight: 700, lineHeight: 1, letterSpacing: 2 }}>{title}</div>
            {score && (
              <div style={{ display: "flex", fontSize: 26, letterSpacing: 6, color: MUTED }}>
                {score.root} {score.scale.toUpperCase()} · {score.bpm} BPM · {score.parts.length} PARTS
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", marginTop: "auto", borderTop: `2px solid ${LINE}`, paddingTop: 14 }}>
          {score ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={svgDataUri(rollSvg(score, INK, LINE))} width={1104} height={250} alt="" />
          ) : (
            <div style={{ display: "flex", fontSize: 28, color: MUTED }}>Couldn&apos;t read these Normies right now.</div>
          )}
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
  res.headers.set(
    "Cache-Control",
    !complete ? "public, s-maxage=60" : block ? "public, s-maxage=86400, stale-while-revalidate=604800" : "public, s-maxage=300",
  )
  return res
}
