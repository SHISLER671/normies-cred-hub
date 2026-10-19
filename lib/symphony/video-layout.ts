// Pixel Symphony MP4 export: layout and timing. Pure, no DOM, so it is testable in Node.
// Mirrors the share card (app/api/symphony/card/route.tsx) on a 1280×720 frame: header, faces, title + key line, and the
// pixel score along the bottom. Every rect is whole pixels so the 1-bit art stays crisp after H.264.

import { playheadColumn } from "./timeline"
import { ROLL_COLS, ROLL_ROWS_PER_PART } from "./roll"
import type { VoiceScore } from "./types"

export const VIDEO_WIDTH = 1280
export const VIDEO_HEIGHT = 720
export const VIDEO_FPS = 30
/** Same tail as the WAV: one loop plus the reverb ring-out. */
export const VIDEO_TAIL_SECONDS = 2.5
/** Hard cap so a big room never makes a huge file. */
export const VIDEO_MAX_SECONDS = 60
/** The synth schedules the first loop this many seconds into the render (see renderWav / renderBuffer). */
export const AUDIO_LEAD_IN_SECONDS = 0.05
export const MAX_FACES = 6

/** Normies monochrome, as on the card. No cyan in the video. */
export const VIDEO_COLORS = { ink: "#1a1b1c", paper: "#e3e5e4", muted: "#939494", line: "#38393a" } as const

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface VideoLayout {
  width: number
  height: number
  /** "NCH · PIXEL SYMPHONY" tag box (top-left). */
  tag: Rect
  /** Right edge + baseline row for "BLOCK N" / "LIVE PIXELS" (top-right). */
  blockLabel: Rect
  /** One square per face (up to MAX_FACES); each side is a multiple of 40 so 40×40 grids scale by whole pixels. */
  faces: Rect[]
  /** The "+N" tile when more than MAX_FACES Normies are in the room. */
  more: Rect | null
  title: Rect
  titleSize: number
  subtitle: Rect
  /** Divider line above the score. */
  divider: Rect
  /** The pixel score: ROLL_COLS × rows cells of cellW × cellH whole pixels. */
  roll: Rect
  rollRows: number
  cellW: number
  cellH: number
}

const PAD_X = 48
const PAD_TOP = 40

/** Frame layout for a room of `faceCount` Normies whose score has `partCount` parts. */
export function videoLayout(faceCount: number, partCount: number, title: string): VideoLayout {
  const width = VIDEO_WIDTH
  const height = VIDEO_HEIGHT
  const tag: Rect = { x: PAD_X, y: PAD_TOP, w: 320, h: 44 }
  const blockLabel: Rect = { x: width - PAD_X - 400, y: PAD_TOP, w: 400, h: 44 }

  const solo = faceCount <= 1
  const side = solo ? 160 : 80
  const gap = 8
  const facesTop = tag.y + tag.h + 30
  const shown = Math.min(Math.max(faceCount, 0), MAX_FACES)
  const faces: Rect[] = []
  for (let i = 0; i < shown; i++) faces.push({ x: PAD_X + i * (side + gap), y: facesTop, w: side, h: side })
  const more: Rect | null = faceCount > MAX_FACES ? { x: PAD_X + shown * (side + gap), y: facesTop, w: side, h: side } : null
  const tiles = shown + (more ? 1 : 0)
  const facesRight = tiles ? PAD_X + tiles * side + (tiles - 1) * gap : PAD_X

  const titleX = facesRight + 28
  const titleW = width - PAD_X - titleX
  const titleSize = title.length > 12 ? 52 : 72
  const textBlock = titleSize + 10 + 30
  const textTop = facesTop + Math.round((side - textBlock) / 2)
  const titleRect: Rect = { x: titleX, y: textTop, w: titleW, h: titleSize }
  const subtitle: Rect = { x: titleX, y: textTop + titleSize + 10, w: titleW, h: 30 }

  const rollRows = Math.max(1, partCount) * ROLL_ROWS_PER_PART
  const dividerY = facesTop + side + 28
  const divider: Rect = { x: PAD_X, y: dividerY, w: width - 2 * PAD_X, h: 2 }
  const rollTop = dividerY + 2 + 16
  const availW = width - 2 * PAD_X
  const availH = height - 32 - rollTop
  const cellW = Math.max(1, Math.floor(availW / ROLL_COLS))
  const cellH = Math.max(1, Math.min(cellW, Math.floor(availH / rollRows)))
  const rollW = cellW * ROLL_COLS
  const rollH = cellH * rollRows
  const roll: Rect = { x: Math.floor((width - rollW) / 2), y: rollTop + Math.floor((availH - rollH) / 2), w: rollW, h: rollH }

  return { width, height, tag, blockLabel, faces, more, title: titleRect, titleSize, subtitle, divider, roll, rollRows, cellW, cellH }
}

/** Seconds of video: one loop plus the tail, capped at VIDEO_MAX_SECONDS. */
export function videoSeconds(score: Pick<VoiceScore, "loopSeconds">): number {
  return Math.min(VIDEO_MAX_SECONDS, Math.max(0, score.loopSeconds) + VIDEO_TAIL_SECONDS)
}

/** Total frames at VIDEO_FPS. */
export function frameCount(score: Pick<VoiceScore, "loopSeconds">): number {
  return Math.ceil(videoSeconds(score) * VIDEO_FPS)
}

/** Presentation time of a frame in seconds (frameIndex / fps; never the wall clock). */
export function frameSeconds(frameIndex: number): number {
  return frameIndex / VIDEO_FPS
}

/** Presentation time of a frame in microseconds, as WebCodecs wants it. */
export function frameMicros(frameIndex: number): number {
  return Math.round((frameIndex * 1_000_000) / VIDEO_FPS)
}

/**
 * The score column under the playhead for a frame, or null once the loop has finished (the tail just rings out).
 * Uses the same maths as the player (playheadColumn), shifted by the synth's lead-in so it lands on the notes.
 */
export function framePlayhead(frameIndex: number, score: Pick<VoiceScore, "loopSeconds">, cols = ROLL_COLS): number | null {
  const t = frameSeconds(frameIndex) - AUDIO_LEAD_IN_SECONDS
  if (t < 0) return 0
  if (t >= score.loopSeconds) return null
  return playheadColumn(t, score.loopSeconds, cols)
}
