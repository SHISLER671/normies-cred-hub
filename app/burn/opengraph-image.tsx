import { ImageResponse } from "next/og"

/** The card people see when a /burn link is pasted into a chat or post. Static: it says what the page does, not whose wallet it is. */
export const alt = "Burn or keep? Paste a wallet and get a straight answer. Read-only, no signing."
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

// The pixel face from the page header: 9 x 9 cells.
const FACE = [
  [0, 1, 2, 3, 4, 5, 6, 7],
  [0, 8],
  [0, 2, 6, 8],
  [0, 8],
  [0, 8],
  [0, 2, 6, 8],
  [0, 3, 4, 5, 8],
  [0, 8],
  [1, 2, 3, 4, 5, 6, 7],
]
const CELL = 20
const INK = "#e5e5e5"
const MUTED = "#a3a3a3"

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0d0d0d", color: INK, padding: 64, border: `2px solid ${MUTED}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 26, letterSpacing: 6, color: MUTED }}>NORMIES CREDHUB</div>

        <div style={{ display: "flex", alignItems: "center", gap: 56 }}>
          <div style={{ display: "flex", flexDirection: "column", width: 9 * CELL, height: 9 * CELL }}>
            {FACE.map((row, y) => (
              <div key={y} style={{ display: "flex", height: CELL }}>
                {Array.from({ length: 9 }, (_, x) => (
                  <div key={x} style={{ width: CELL, height: CELL, background: row.includes(x) ? INK : "transparent" }} />
                ))}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", fontSize: 104, lineHeight: 1, letterSpacing: -3 }}>Burn or keep?</div>
            <div style={{ display: "flex", fontSize: 38, color: MUTED }}>Paste a wallet. Get a straight answer.</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", gap: 16, fontSize: 24, letterSpacing: 3 }}>
            {["READ-ONLY", "NO SIGNING", "NO CONNECTING", "NOT FINANCIAL ADVICE"].map((t) => (
              <div key={t} style={{ display: "flex", alignItems: "center", lineHeight: 1, border: `2px solid ${MUTED}`, padding: "16px 18px" }}>{t}</div>
            ))}
          </div>
          <div style={{ display: "flex", fontSize: 24, color: MUTED }}>Independent community tool, not made by the Normies team  ·  normiescredhub.vercel.app/burn</div>
        </div>
      </div>
    ),
    { ...size },
  )
}
