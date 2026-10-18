import { ImageResponse } from "next/og"

import { parseTokenId } from "@/lib/api/agent-pulse"
import { loadRecordCard } from "@/lib/record-card/load"

/** The preview people see when a /record/{id} link is pasted into X, Discord or a chat. Built from the live card. */
export const alt = "Normie record card: verified identity, trust gate and Arena record. Read-only."
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export const revalidate = 300

const BG = "#1a1b1c"
const INK = "#e3e5e4"
const MUTED = "#a7a8a8"
const LINE = "#38393a"

function Stat({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "18px 22px", borderRight: `2px solid ${LINE}`, flex: 1 }}>
      <div style={{ display: "flex", fontSize: 20, letterSpacing: 4, color: MUTED }}>{label}</div>
      <div style={{ display: "flex", fontSize: 48, lineHeight: 1, color: muted ? MUTED : INK }}>{value}</div>
    </div>
  )
}

export default async function Image({ params }: { params: Promise<{ tokenId: string }> }) {
  const { tokenId: raw } = await params
  const tokenId = parseTokenId(raw) ?? 0
  const card = await loadRecordCard(tokenId).catch(() => null)

  const name = card?.identity.agent_name.value ?? `Normie #${tokenId}`
  const agentId = card?.identity.agent_id.value
  const gate = card?.pulse.gate.passed
  const level = card?.identity.level.value
  const pixels = card?.identity.pixels_attached.value
  const arenaPending = !card || card.sectors.arena.record.matches.value === null
  const matches = card?.sectors.arena.record.matches.value

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: BG, color: INK, padding: 56, border: `2px solid ${LINE}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 24, letterSpacing: 6, color: MUTED }}>
          <div style={{ display: "flex" }}>NORMIES CREDHUB · RECORD CARD</div>
          <div style={{ display: "flex", color: INK }}>#{tokenId}</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://api.normies.art/normie/${tokenId}/image.png`}
            width={220}
            height={220}
            alt=""
            style={{ border: `3px solid ${INK}`, background: "#242526", imageRendering: "pixelated" }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", fontSize: 96, lineHeight: 1, letterSpacing: -2 }}>{name}</div>
            <div style={{ display: "flex", gap: 14, fontSize: 24, letterSpacing: 3 }}>
              {agentId != null && (
                <div style={{ display: "flex", padding: "12px 16px", border: `2px solid ${INK}`, color: INK }}>AGENT #{agentId}</div>
              )}
              <div style={{ display: "flex", padding: "12px 16px", border: `2px solid ${gate ? INK : MUTED}`, color: gate ? INK : MUTED }}>
                {gate ? "TRUST GATE PASSED" : "TRUST GATE NOT PASSED"}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", borderTop: `2px solid ${LINE}`, borderLeft: `2px solid ${LINE}`, borderBottom: `2px solid ${LINE}` }}>
            <Stat label="LEVEL" value={level != null ? String(level) : "—"} />
            <Stat label="PIXELS ON IT" value={pixels != null ? String(pixels) : "—"} />
            <Stat label="ARENA MATCHES" value={arenaPending ? "pending" : String(matches)} muted={arenaPending} />
          </div>
          <div style={{ display: "flex", fontSize: 22, color: MUTED }}>
            Verified sources only · read-only · not a tip · normiescredhub.vercel.app/record/{tokenId}
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
