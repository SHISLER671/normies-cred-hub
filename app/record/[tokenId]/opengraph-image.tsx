import { ImageResponse } from "next/og"

import { NORMIES_API_BASE } from "@/constants/contracts"
import { parseTokenId } from "@/lib/api/agent-pulse"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"
import { pulseBeats } from "@/lib/pulse/beats"
import { loadRecordCard } from "@/lib/record-card/load"
import { cleanBitmap, faceSvg, svgDataUri, traceSvg } from "@/lib/record-card/og-art"

/**
 * The preview people see when a /record/{id} link is pasted into X, Discord or a chat. Built from the live card.
 * Nothing here loads a picture from another server: the face is drawn from the Normie's on-chain 40×40 bitmap and the
 * heartbeat from its Pulse, so the image cannot break on a missing or unsupported remote file.
 */
export const alt = "Normie record card: pixel face, trust gate and Pulse heartbeat. Read-only."
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export const revalidate = 300

const BG = "#1a1b1c"
const INK = "#e3e5e4"
const MUTED = "#939494"
const LINE = "#38393a"
const GRID_LINE = "#252627"

async function loadBitmap(tokenId: number): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(`${NORMIES_API_BASE}/normie/${tokenId}/pixels`, { next: { revalidate: 300 } }, 5_000)
    return res.ok ? cleanBitmap(await res.text()) : null
  } catch {
    return null
  }
}

function Tag({ children, solid }: { children: React.ReactNode; solid?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        padding: "8px 14px",
        border: `2px solid ${solid ? INK : LINE}`,
        background: solid ? INK : "transparent",
        color: solid ? BG : MUTED,
        fontSize: 20,
        letterSpacing: 5,
      }}
    >
      {children}
    </div>
  )
}

export default async function Image({ params }: { params: Promise<{ tokenId: string }> }) {
  const { tokenId: raw } = await params
  const tokenId = parseTokenId(raw) ?? 0
  const [card, bitmap] = await Promise.all([loadRecordCard(tokenId).catch(() => null), loadBitmap(tokenId)])

  const name = (card?.identity.agent_name.value ?? `Normie #${tokenId}`).toUpperCase()
  const agentId = card?.identity.agent_id.value ?? null
  const pulse = card?.pulse
  const ready = !!pulse?.available && card?.card_status !== "not_awakened"
  const level = ready ? (pulse!.level ?? 0) : null
  const max = pulse?.max_level ?? 5
  const beats = pulseBeats(ready ? pulse!.breakdown : [])
  const gate = ready ? pulse!.gate.passed : null

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: BG,
          color: INK,
          padding: "40px 48px",
          // Faint 40px grid, like the normies.art hero.
          backgroundImage: `linear-gradient(to right, ${GRID_LINE} 1px, transparent 1px), linear-gradient(to bottom, ${GRID_LINE} 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Tag>NORMIES CREDHUB · RECORD CARD</Tag>
          <div style={{ display: "flex", fontSize: 20, letterSpacing: 5, color: MUTED }}>READ-ONLY · NOT A TIP</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 40, marginTop: 28 }}>
          {bitmap ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={svgDataUri(faceSvg(bitmap))} width={200} height={200} alt="" />
          ) : (
            <div
              style={{
                display: "flex",
                width: 200,
                height: 200,
                alignItems: "center",
                justifyContent: "center",
                background: INK,
                color: BG,
                fontSize: 44,
              }}
            >
              #{tokenId}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", fontSize: name.length > 12 ? 60 : 88, lineHeight: 1, fontWeight: 700, letterSpacing: 2, maxWidth: 860 }}>
              {name}
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <Tag>NORMIE #{tokenId}</Tag>
              {agentId !== null && <Tag>AGENT #{agentId}</Tag>}
              {gate !== null && <Tag solid={gate}>{gate ? "TRUST GATE PASSED" : "TRUST GATE NOT PASSED"}</Tag>}
            </div>
            {level !== null && (
              <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <div style={{ display: "flex", gap: 6 }}>
                  {Array.from({ length: max }, (_, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        width: 24,
                        height: 24,
                        background: i < level ? INK : "transparent",
                        border: i < level ? "none" : `3px solid ${MUTED}`,
                      }}
                    />
                  ))}
                </div>
                <div style={{ display: "flex", fontSize: 26, letterSpacing: 6 }}>
                  PULSE {level} OF {max} · {(pulse!.status ?? "").toUpperCase()}
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", marginTop: "auto", borderTop: `2px solid ${LINE}`, paddingTop: 14 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={svgDataUri(traceSvg(beats, INK, "#5c5d5e"))} width={1100} height={242} alt="" />
        </div>
      </div>
    ),
    { ...size },
  )
}
