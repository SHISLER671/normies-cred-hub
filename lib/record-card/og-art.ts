// Pure SVG art for the record card share image (app/record/[tokenId]/opengraph-image.tsx).
// Drawn from data, never fetched as a picture: the Normie face comes from its on-chain bitmap, 40×40 at mint and
// 50–80 once enlarged (GET api.normies.art/normie/{id}/pixels, a string of "0"/"1"), and the heartbeat from the Pulse
// breakdown.

import { beatPixels, PIXEL_COLS, type LitBeat } from "@/lib/pulse/beats"

/** Official Normie grid sides: 40 at mint, then the canvas enlargement sizes. */
export const NORMIE_GRID_SIDES = [40, 50, 60, 70, 80] as const

/** Keep only 0/1 characters; valid when a Normie-sized square remains (1,600 at mint; up to 6,400 when enlarged). */
export function cleanBitmap(raw: string | null | undefined): string | null {
  if (!raw) return null
  const bits = raw.replace(/[^01]/g, "")
  return NORMIE_GRID_SIDES.some((n) => n * n === bits.length) ? bits : null
}

function sideOf(bitmap: string): number {
  const n = Math.round(Math.sqrt(bitmap.length))
  return n > 0 && n * n === bitmap.length ? n : 40
}

/** The face as an SVG: paper square, ink pixels, crisp edges. */
export function faceSvg(bitmap: string, ink = "#1a1b1c", paper = "#e3e5e4"): string {
  const n = sideOf(bitmap)
  let d = ""
  for (let i = 0; i < bitmap.length; i++) {
    if (bitmap[i] === "1") d += `M${i % n} ${Math.floor(i / n)}h1v1h-1z`
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges">` +
    `<rect width="${n}" height="${n}" fill="${paper}"/><path d="${d}" fill="${ink}"/></svg>`
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
