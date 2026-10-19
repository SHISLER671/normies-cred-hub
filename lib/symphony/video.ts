// Pixel Symphony MP4 export (client-only). Renders one loop of the song to an H.264 + AAC MP4 in the browser and
// returns it as a Blob: nothing is uploaded and there is no server route. Frames are drawn on a canvas in Normies
// monochrome (mirroring the share card), encoded with WebCodecs and muxed by mediabunny with the moov atom up front
// ("fast start"), which X and phones need. mediabunny is loaded with import() only when someone taps ⤓ MP4.

import { viewGrid } from "./grid"
import { rollCells, ROLL_COLS, ROLL_ROWS_PER_PART } from "./roll"
import { playheadColumn } from "./timeline"
import type { VoiceScore } from "./types"
import {
  AUDIO_LEAD_IN_SECONDS,
  frameCount,
  framePlayhead,
  frameSeconds,
  MAX_FACES,
  VIDEO_COLORS,
  VIDEO_FPS,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
  videoLayout,
  videoSeconds,
  type Rect,
  type VideoLayout,
} from "./video-layout"

export const VIDEO_BITRATE = 3_000_000
export const AUDIO_BITRATE = 128_000
export const AUDIO_SAMPLE_RATE = 48_000
export const AUDIO_CODEC = "mp4a.40.2"
/** Baseline 3.1 first (plays everywhere), then Main and High at the same level if the encoder refuses Baseline. */
export const VIDEO_CODECS = ["avc1.42E01F", "avc1.4D401F", "avc1.64001F"] as const
export const VIDEO_UNSUPPORTED_HINT = "Video export needs Chrome or Safari"

export type VideoVoice = { name: string; pixels: string }
export type VideoSupport = { supported: true; videoCodec: string } | { supported: false }

type Canvas = HTMLCanvasElement | OffscreenCanvas
type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

const FONT = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif'

let supportCheck: Promise<VideoSupport> | null = null

/**
 * Can this browser make the MP4? Needs WebCodecs VideoEncoder (H.264) and AudioEncoder (AAC-LC). There is deliberately
 * no Opus fallback: X rejects it. Never throws; Firefox and Linux Chromium (no AAC encoder) get { supported: false }.
 */
export function videoExportSupport(): Promise<VideoSupport> {
  if (!supportCheck) supportCheck = detect()
  return supportCheck
}

async function detect(): Promise<VideoSupport> {
  try {
    if (typeof window === "undefined" || typeof VideoEncoder === "undefined" || typeof AudioEncoder === "undefined") {
      return { supported: false }
    }
    const audio = await AudioEncoder.isConfigSupported({
      codec: AUDIO_CODEC,
      sampleRate: AUDIO_SAMPLE_RATE,
      numberOfChannels: 2,
      bitrate: AUDIO_BITRATE,
    })
    if (!audio.supported) return { supported: false }
    for (const codec of VIDEO_CODECS) {
      const video = await VideoEncoder.isConfigSupported({
        codec,
        width: VIDEO_WIDTH,
        height: VIDEO_HEIGHT,
        bitrate: VIDEO_BITRATE,
        framerate: VIDEO_FPS,
      })
      if (video.supported) return { supported: true, videoCodec: codec }
    }
    return { supported: false }
  } catch {
    return { supported: false }
  }
}

function makeCanvas(w: number, h: number): Canvas {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h)
  const c = document.createElement("canvas")
  c.width = w
  c.height = h
  return c
}

function ctx2d(c: Canvas): Ctx2D {
  const g = c.getContext("2d", { alpha: false }) as Ctx2D | null
  if (!g) throw new Error("Canvas 2D is not available")
  g.imageSmoothingEnabled = false
  return g
}

function spacing(g: Ctx2D, px: number) {
  if ("letterSpacing" in g) (g as Ctx2D & { letterSpacing: string }).letterSpacing = `${px}px`
}

/** Text that shrinks until it fits `maxW`. */
function fitText(g: Ctx2D, text: string, x: number, y: number, maxW: number, size: number, weight: number, track: number) {
  let s = size
  for (;;) {
    g.font = `${weight} ${s}px ${FONT}`
    spacing(g, track)
    if (g.measureText(text).width <= maxW || s <= 12) break
    s -= 2
  }
  g.fillText(text, x, y)
}

/** Whole-pixel square for an n×n grid inside a face box: the largest integer scale, centred. */
function faceGeometry(r: Rect, n: number) {
  const s = Math.max(1, Math.floor(r.w / n))
  return { s, ox: r.x + Math.floor((r.w - s * n) / 2), oy: r.y + Math.floor((r.h - s * n) / 2) }
}

/** Ink pixels on paper, the same colours as faceSvg() on the share card, drawn as whole-pixel rects. Grids bigger
 * than the box (e.g. a 256×256 canvas in an 80 px tile) are sampled down to fit, never drawn past the box. */
function drawFace(g: Ctx2D, r: Rect, raw: string) {
  let n: number
  let pixels: string
  try {
    const v = viewGrid(raw, r.w)
    n = v.side
    pixels = v.pixels
  } catch {
    return
  }
  const { s, ox, oy } = faceGeometry(r, n)
  g.fillStyle = VIDEO_COLORS.paper
  g.fillRect(r.x, r.y, r.w, r.h)
  g.fillStyle = VIDEO_COLORS.ink
  for (let i = 0; i < pixels.length; i++) if (pixels[i] === "1") g.fillRect(ox + (i % n) * s, oy + Math.floor(i / n) * s, s, s)
}

/** Everything that does not move: header, faces, title, key line, divider and the score itself. */
function drawStatic(g: Ctx2D, L: VideoLayout, score: VoiceScore, voices: VideoVoice[], block: number | null, title: string, lit: Set<number>) {
  const { ink, paper, muted, line } = VIDEO_COLORS
  g.fillStyle = ink
  g.fillRect(0, 0, L.width, L.height)
  g.textBaseline = "middle"

  // Header: tag box (left) and block (right).
  g.strokeStyle = line
  g.lineWidth = 2
  g.font = `400 20px ${FONT}`
  spacing(g, 5)
  const tag = "NCH · PIXEL SYMPHONY"
  const tagW = Math.min(L.tag.w + 80, Math.ceil(g.measureText(tag).width) + 28)
  g.strokeRect(L.tag.x + 1, L.tag.y + 1, tagW - 2, L.tag.h - 2)
  g.fillStyle = muted
  g.textAlign = "left"
  g.fillText(tag, L.tag.x + 14, L.tag.y + L.tag.h / 2)
  g.textAlign = "right"
  g.fillText(block ? `BLOCK ${block}` : "LIVE PIXELS", L.blockLabel.x + L.blockLabel.w, L.blockLabel.y + L.blockLabel.h / 2)
  g.textAlign = "left"

  // Faces, then "+N".
  voices.slice(0, MAX_FACES).forEach((v, i) => L.faces[i] && drawFace(g, L.faces[i], v.pixels))
  if (L.more) {
    g.strokeRect(L.more.x + 1, L.more.y + 1, L.more.w - 2, L.more.h - 2)
    g.fillStyle = muted
    g.font = `400 28px ${FONT}`
    spacing(g, 0)
    g.textAlign = "center"
    g.fillText(`+${voices.length - MAX_FACES}`, L.more.x + L.more.w / 2, L.more.y + L.more.h / 2)
    g.textAlign = "left"
  }

  // Title, then key · tempo · parts.
  g.fillStyle = paper
  fitText(g, title, L.title.x, L.title.y + L.title.h / 2, L.title.w, L.titleSize, 700, 2)
  g.fillStyle = muted
  fitText(g, `${score.root} ${score.scale.toUpperCase()} · ${score.bpm} BPM · ${score.parts.length} PARTS`, L.subtitle.x, L.subtitle.y + L.subtitle.h / 2, L.subtitle.w, 26, 400, 6)

  // Divider, lane lines, score cells.
  g.fillStyle = line
  g.fillRect(L.divider.x, L.divider.y, L.divider.w, L.divider.h)
  for (let p = 1; p < score.parts.length; p++) g.fillRect(L.roll.x, L.roll.y + p * ROLL_ROWS_PER_PART * L.cellH - Math.max(1, Math.floor(L.cellH / 6)), L.roll.w, 1)
  g.fillStyle = paper
  for (const k of lit) {
    const x = k % ROLL_COLS
    const y = Math.floor(k / ROLL_COLS)
    g.fillRect(L.roll.x + x * L.cellW, L.roll.y + y * L.cellH, L.cellW, L.cellH)
  }
}

/** The moving part: invert the score column under the playhead, and the lead Normie's playing pixel column. */
function drawPlayhead(g: Ctx2D, L: VideoLayout, lit: Set<number>, col: number | null, lead: { pixels: string; n: number } | null, leadCol: number | null) {
  const { ink, paper } = VIDEO_COLORS
  if (col !== null) {
    const x = L.roll.x + col * L.cellW
    for (let y = 0; y < L.rollRows; y++) {
      g.fillStyle = lit.has(y * ROLL_COLS + col) ? ink : paper
      g.fillRect(x, L.roll.y + y * L.cellH, L.cellW, L.cellH)
    }
  }
  if (lead && leadCol !== null && L.faces[0]) {
    const { s, ox, oy } = faceGeometry(L.faces[0], lead.n)
    for (let y = 0; y < lead.n; y++) {
      g.fillStyle = lead.pixels[y * lead.n + leadCol] === "1" ? paper : ink
      g.fillRect(ox + leadCol * s, oy + y * s, s, s)
    }
  }
}

/** Copy [from, to) samples of a buffer into a new AudioBuffer. */
function slice(buf: AudioBuffer, from: number, to: number): AudioBuffer {
  const out = new AudioBuffer({ length: Math.max(1, to - from), numberOfChannels: buf.numberOfChannels, sampleRate: buf.sampleRate })
  for (let c = 0; c < buf.numberOfChannels; c++) out.copyToChannel(buf.getChannelData(c).subarray(from, to), c)
  return out
}

/**
 * Build a painter for one song: the static layer (header, faces, title, score) is drawn once; paint(g, f) copies it
 * onto a 1280×720 context and draws frame f's playhead. Exported so a single frame can be previewed or tested.
 */
export function createFramePainter(score: VoiceScore, voices: VideoVoice[], block: number | null) {
  const title = voices.length === 1 ? voices[0].name.toUpperCase() : `${voices.length} NORMIES`
  const L = videoLayout(voices.length, score.parts.length, title)
  const lit = new Set(rollCells(score).map(([x, y]) => y * ROLL_COLS + x))
  let lead: { pixels: string; n: number } | null = null
  try {
    if (voices[0] && L.faces[0]) {
      const v = viewGrid(voices[0].pixels, L.faces[0].w)
      lead = { pixels: v.pixels, n: v.side }
    }
  } catch {
    lead = null
  }
  const base = makeCanvas(VIDEO_WIDTH, VIDEO_HEIGHT)
  drawStatic(ctx2d(base), L, score, voices, block, title, lit)
  return (g: Ctx2D, frameIndex: number) => {
    g.imageSmoothingEnabled = false
    g.drawImage(base, 0, 0)
    const loopT = frameSeconds(frameIndex) - AUDIO_LEAD_IN_SECONDS
    const leadCol = lead && loopT < score.loopSeconds ? playheadColumn(Math.max(0, loopT), score.loopSeconds, lead.n) : null
    drawPlayhead(g, L, lit, framePlayhead(frameIndex, score), lead, leadCol)
  }
}

/**
 * Render one loop (+ 2.5 s tail, capped at 60 s) of `score` to an MP4 Blob: 1280×720, 30 fps, H.264 ~3 Mbps with a
 * keyframe every 2 s, AAC-LC stereo 128 kbps at 48 kHz, fast start. Frames are encoded as fast as the encoder accepts
 * them; each frame's timestamp is frameIndex / 30 s. Call videoExportSupport() first.
 */
export async function renderMp4(
  score: VoiceScore,
  voices: VideoVoice[],
  block: number | null,
  onProgress?: (fraction: number) => void,
): Promise<Blob> {
  const support = await videoExportSupport()
  if (!support.supported) throw new Error(VIDEO_UNSUPPORTED_HINT)

  const [{ Output, Mp4OutputFormat, BufferTarget, CanvasSource, AudioBufferSource, Quality }, { renderBuffer }] = await Promise.all([
    import("mediabunny"),
    import("./synth"),
  ])

  const seconds = videoSeconds(score)
  const frames = frameCount(score)
  const frame = makeCanvas(VIDEO_WIDTH, VIDEO_HEIGHT)
  const g = ctx2d(frame)
  const paint = createFramePainter(score, voices, block)

  // Audio: the same offline render as the WAV, at 48 kHz, trimmed to the video length.
  const full = await renderBuffer(score, AUDIO_SAMPLE_RATE)
  const audioEnd = Math.min(full.length, Math.round(seconds * AUDIO_SAMPLE_RATE))
  onProgress?.(0.05)

  const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() })
  const video = new CanvasSource(frame, {
    codec: "avc",
    fullCodecString: support.videoCodec,
    quality: new Quality({ bitrate: VIDEO_BITRATE }),
    keyFrameInterval: 2,
    latencyMode: "quality",
  })
  const audio = new AudioBufferSource({ codec: "aac", fullCodecString: AUDIO_CODEC, quality: new Quality({ bitrate: AUDIO_BITRATE }) })
  output.addVideoTrack(video, { frameRate: VIDEO_FPS })
  output.addAudioTrack(audio)
  await output.start()

  // Interleave: keep the audio about a second ahead of the frames so the muxer never waits on one track.
  let audioAt = 0
  const feedAudio = async (untilSeconds: number) => {
    const until = Math.min(audioEnd, Math.round(untilSeconds * AUDIO_SAMPLE_RATE))
    while (audioAt < until) {
      const next = Math.min(until, audioAt + AUDIO_SAMPLE_RATE)
      await audio.add(slice(full, audioAt, next))
      audioAt = next
    }
  }

  try {
    for (let f = 0; f < frames; f++) {
      const t = frameSeconds(f)
      await feedAudio(t + 1)
      paint(g, f)
      await video.add(t, 1 / VIDEO_FPS)
      if (f % 15 === 0) onProgress?.(0.05 + 0.9 * (f / frames))
    }
    await feedAudio(seconds)
    video.close()
    audio.close()
    await output.finalize()
  } catch (err) {
    await output.cancel().catch(() => {})
    throw err
  }
  onProgress?.(1)
  const bytes = (output.target as InstanceType<typeof BufferTarget>).buffer
  if (!bytes) throw new Error("MP4 export produced no data")
  return new Blob([bytes], { type: "video/mp4" })
}
