// Pure SVG art for the record card share image (app/record/[tokenId]/opengraph-image.tsx).
// Drawn from data, never fetched as a picture: the Normie face comes from its on-chain 40×40 bitmap
// (GET api.normies.art/normie/{id}/pixels, a string of "0"/"1"), and the heartbeat from the Pulse breakdown.

import { beatPixels, PIXEL_COLS, type LitBeat } from "@/lib/pulse/beats"

const GRID = 40

/** Keep only 0/1 characters; valid when exactly 1,600 remain (row-major, top-left first). */
export function cleanBitmap(raw: string | null | undefined): string | null {
  if (!raw) return null
  const bits = raw.replace(/[^01]/g, "")
  return bits.length === GRID * GRID ? bits : null
}

/** The face as an SVG: paper square, ink pixels, crisp edges. */
export function faceSvg(bitmap: string, ink = "#1a1b1c", paper = "#e3e5e4"): string {
  let d = ""
  for (let i = 0; i < bitmap.length; i++) {
    if (bitmap[i] === "1") d += `M${i % GRID} ${Math.floor(i / GRID)}h1v1h-1z`
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID} ${GRID}" shape-rendering="crispEdges">` +
    `<rect width="${GRID}" height="${GRID}" fill="${paper}"/><path d="${d}" fill="${ink}"/></svg>`
  )
}

/** The pixel heartbeat as an SVG (rows 1–22 of the 24-row grid, where the line lives). */
export function traceSvg(beats: LitBeat[], lit = "#e3e5e4", dim = "#5c5d5e"): string {
  const path = (on: boolean) =>
    beats
      .map((b, i) => (b.lit === on ? beatPixels(i, b.lit).map(([x, y]) => `M${x} ${y}h1v1h-1z`).join("") : ""))
      .join("")
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 1 ${PIXEL_COLS} 22" shape-rendering="crispEdges">` +
    `<path d="${path(false)}" fill="${dim}"/><path d="${path(true)}" fill="${lit}"/></svg>`
  )
}

/** SVG string → data URI the image renderer can draw. */
export function svgDataUri(svg: string): string {
  const b64 =
    typeof Buffer !== "undefined" ? Buffer.from(svg, "utf8").toString("base64") : btoa(unescape(encodeURIComponent(svg)))
  return `data:image/svg+xml;base64,${b64}`
}
