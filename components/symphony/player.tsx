"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { composeScore, gridSide } from "@/lib/symphony/compose"
import { MAX_ROOM, parseIds, symphonyPath, symphonyShareText } from "@/lib/symphony/pin"
import { playheadColumn } from "@/lib/symphony/timeline"
import type { AwakenedBinding, NormieTrait, VoiceScore } from "@/lib/symphony/types"

type Voice = {
  tokenId: number
  name: string
  pixels: string
  gridSize: number
  traits: NormieTrait[]
  block: number | null
  awakened?: AwakenedBinding | null
}
type Player = { stop: () => void; elapsed: () => number; spectrum: (out: Uint8Array<ArrayBuffer>) => void; bins: number }

const PART_LABEL: Record<string, string> = { pad: "PAD", bass: "BASS", primary: "LEAD", harmony: "HARMONY", arp: "ARP", counter: "COUNTER" }

function mmss(s: number): string {
  const t = Math.max(0, Math.floor(s))
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`
}

/**
 * Pixel Symphony. One Normie makes a blip; up to 12 layer into a room. Every song is computed in the browser from the
 * Normies' official on-chain pixels and traits. Share links pin an Ethereum block, so the song can be replayed exactly
 * by anyone, forever, without anything being saved. Read-only.
 */
export function SymphonyPlayer({ initialIds, initialBlock }: { initialIds: number[]; initialBlock: number | null }) {
  const [raw, setRaw] = useState(initialIds.join(", "))
  const [voices, setVoices] = useState<Voice[]>([])
  const [score, setScore] = useState<VoiceScore | null>(null)
  const [block, setBlock] = useState<number | null>(initialBlock)
  const [pinned, setPinned] = useState(initialBlock !== null)
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [error, setError] = useState("")
  const [skipped, setSkipped] = useState<number[]>([])
  const [playing, setPlaying] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [exporting, setExporting] = useState(false)
  // MP4: null = still checking the browser, false = can't encode H.264 + AAC here.
  const [videoOk, setVideoOk] = useState<boolean | null>(null)
  const [videoProgress, setVideoProgress] = useState<number | null>(null)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoFailed, setVideoFailed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [origin, setOrigin] = useState("")

  const player = useRef<Player | null>(null)
  const raf = useRef<number | null>(null)
  const gridRef = useRef<HTMLCanvasElement | null>(null)
  const eqRef = useRef<HTMLCanvasElement | null>(null)

  const stop = useCallback(() => {
    player.current?.stop()
    player.current = null
    if (raf.current) cancelAnimationFrame(raf.current)
    raf.current = null
    setPlaying(false)
    setElapsed(0)
  }, [])

  const load = useCallback(
    async (ids: number[], atBlock: number | null) => {
      stop()
      if (!ids.length) return
      setStatus("loading")
      setError("")
      const q = atBlock ? `?block=${atBlock}` : ""
      const results = await Promise.all(
        ids.map(async (id) => {
          try {
            const r = await fetch(`/api/symphony/voice/${id}${q}`)
            return r.ok ? ((await r.json()) as Voice) : null
          } catch {
            return null
          }
        }),
      )
      const ok = results.filter((v): v is Voice => v !== null)
      setSkipped(ids.filter((id) => !ok.some((v) => v.tokenId === id)))
      if (!ok.length) {
        setStatus("error")
        setError(ids.length === 1 ? `Couldn't read #${ids[0]}` : "Couldn't read these Normies")
        return
      }
      setVoices(ok)
      setScore(composeScore(ok))
      setBlock(atBlock ?? ok[0].block)
      setPinned(atBlock !== null)
      setStatus("ready")
    },
    [stop],
  )

  useEffect(() => {
    let live = true
    import("@/lib/symphony/video")
      .then((m) => m.videoExportSupport())
      .then((r) => live && setVideoOk(r.supported))
      .catch(() => live && setVideoOk(false))
    return () => {
      live = false
    }
  }, [])

  // A new song means the shared video is stale.
  useEffect(() => setVideoFile(null), [score])

  useEffect(() => {
    setOrigin(window.location.origin)
    void load(initialIds.length ? initialIds : [7141], initialBlock)
    return () => stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const primary = voices[0] ?? null

  // Draw the lead Normie's pixels, with the playing column inverted.
  const drawGrid = useCallback(
    (col: number | null) => {
      const c = gridRef.current
      if (!c || !primary) return
      const n = gridSide(primary.pixels)
      const g = c.getContext("2d")
      if (!g) return
      c.width = n
      c.height = n
      const css = getComputedStyle(c)
      const ink = css.getPropertyValue("--sym-ink").trim() || "#1a1b1c"
      const paper = css.getPropertyValue("--sym-paper").trim() || "#e3e5e4"
      g.fillStyle = paper
      g.fillRect(0, 0, n, n)
      g.fillStyle = ink
      for (let i = 0; i < primary.pixels.length; i++) if (primary.pixels[i] === "1") g.fillRect(i % n, Math.floor(i / n), 1, 1)
      if (col !== null) {
        for (let y = 0; y < n; y++) {
          g.fillStyle = primary.pixels[y * n + col] === "1" ? paper : ink
          g.fillRect(col, y, 1, 1)
        }
      }
    },
    [primary],
  )

  useEffect(() => drawGrid(null), [drawGrid])

  const play = useCallback(async () => {
    if (!score || !primary) return
    stop()
    const { createPlayer } = await import("@/lib/symphony/synth")
    const p = createPlayer(score)
    player.current = p
    setPlaying(true)
    const bins = new Uint8Array(p.bins)
    const n = gridSide(primary.pixels)
    let lastSec = -1
    const tick = () => {
      const t = p.elapsed()
      // Re-render the clock once a second; the canvases update every frame without React.
      if (Math.floor(t) !== lastSec) {
        lastSec = Math.floor(t)
        setElapsed(t)
      }
      drawGrid(playheadColumn(t, score.loopSeconds, n))
      const eq = eqRef.current
      const g = eq?.getContext("2d")
      if (eq && g) {
        p.spectrum(bins)
        const bars = 24
        const cols = eq.width / bars
        g.clearRect(0, 0, eq.width, eq.height)
        g.fillStyle = getComputedStyle(eq).getPropertyValue("--sym-lcd-ink").trim() || "#e3e5e4"
        for (let b = 0; b < bars; b++) {
          const v = bins[Math.floor((b / bars) * (bins.length * 0.6))] / 255
          const blocks = Math.round(v * 8)
          for (let k = 0; k < blocks; k++) g.fillRect(b * cols + 1, eq.height - (k + 1) * (eq.height / 8) + 1, cols - 2, eq.height / 8 - 2)
        }
      }
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
  }, [score, primary, stop, drawGrid])

  const ids = voices.map((v) => v.tokenId)
  const sharePath = symphonyPath(ids, block)
  const shareUrl = `${origin}${sharePath}`
  const shareText = symphonyShareText(voices.map((v) => v.name), block)
  const cardPath = `/api/symphony/card?ids=${ids.join(",")}${block ? `&block=${block}` : ""}`
  const fileBase = `pixel-symphony-${ids.slice(0, 4).join("-")}${ids.length > 4 ? "-etc" : ""}${block ? `-b${block}` : ""}`

  const download = useCallback(async () => {
    if (!score) return
    setExporting(true)
    try {
      const { renderWav } = await import("@/lib/symphony/synth")
      const blob = await renderWav(score)
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = `${fileBase}.wav`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 5000)
    } finally {
      setExporting(false)
    }
  }, [score, fileBase])

  const renderingVideo = videoProgress !== null

  const downloadMp4 = useCallback(async () => {
    if (!score || !videoOk) return
    setVideoProgress(0)
    setVideoFile(null)
    setVideoFailed(false)
    try {
      const { renderMp4 } = await import("@/lib/symphony/video")
      const blob = await renderMp4(score, voices, block, (f) => setVideoProgress(Math.round(f * 100)))
      const name = `${fileBase}.mp4`
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = name
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 5000)
      try {
        const file = new File([blob], name, { type: "video/mp4" })
        if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) setVideoFile(file)
      } catch {
        // Sharing files isn't available here; the download is enough.
      }
    } catch (err) {
      console.warn("MP4 export failed", err)
      setVideoFailed(true)
    } finally {
      setVideoProgress(null)
    }
  }, [score, videoOk, voices, block, fileBase])

  const shareVideo = async () => {
    if (!videoFile) return
    try {
      await navigator.share({ files: [videoFile], text: shareText })
    } catch {
      // Cancelled or refused by the share sheet: nothing to do.
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt("Copy this link:", shareUrl)
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const next = parseIds(raw)
    if (next.length) {
      setRaw(next.join(", "))
      // A new room plays the live pixels; the share link then pins the current block.
      void load(next, null)
      window.history.replaceState(null, "", symphonyPath(next, null))
    }
  }

  const loop = score?.loopSeconds ?? 0
  const marquee =
    score && primary
      ? `${voices.length === 1 ? primary.name.toUpperCase() : `${voices.length} NORMIES`} · ${score.root} ${score.scale.toUpperCase()} · ${score.bpm} BPM`
      : ""

  return (
    <section className="sym" aria-label="Pixel Symphony player">
      <div className="sym-titlebar" aria-hidden>
        <span className="sym-titlebar-grip" />
        <span className="sym-titlebar-text">PIXEL SYMPHONY</span>
        <span className="sym-titlebar-grip" />
      </div>

      <div className="sym-main">
        <div className="sym-lcd" aria-live="polite">
          <div className="sym-lcd-row">
            <span className="sym-lcd-state">{playing ? "▶" : status === "loading" ? "…" : "■"}</span>
            <span className="sym-lcd-time">{mmss(playing ? elapsed % (loop || 1) : 0)}</span>
            <span className="sym-lcd-total">/ {mmss(loop)}</span>
          </div>
          <div className="sym-lcd-id">
            {ids.length ? ids.map((i) => `#${i}`).join(" ") : "#----"}
            <span className="sym-lcd-block">{block ? `${pinned ? "PINNED" : "BLOCK"} ${block.toLocaleString("en-US")}` : "LIVE"}</span>
          </div>
          <div className="sym-lcd-marquee">
            <span>{status === "error" ? error.toUpperCase() : status === "loading" ? "READING PIXELS…" : marquee}</span>
          </div>
          <canvas ref={eqRef} className="sym-eq" width={240} height={48} aria-hidden />
        </div>

        <div className="sym-face">
          <canvas ref={gridRef} className="sym-grid" aria-label={primary ? `${primary.name}'s pixels; the playing column is inverted` : "Normie pixels"} />
        </div>
      </div>

      <form className="sym-controls" onSubmit={submit}>
        <label className="sr-only" htmlFor="sym-ids">Normie numbers, up to {MAX_ROOM}, separated by commas</label>
        <span className="sym-hash" aria-hidden>#</span>
        <input
          id="sym-ids"
          className="sym-input sym-input-wide"
          inputMode="numeric"
          value={raw}
          placeholder="7141, 1, 42"
          onChange={(e) => setRaw(e.target.value.replace(/[^\d,\s]/g, ""))}
        />
        <button type="submit" className="sym-btn">Load</button>
        {playing ? (
          <button type="button" className="sym-btn" onClick={stop}>■ Stop</button>
        ) : (
          <button type="button" className="sym-btn sym-btn-cta" onClick={play} disabled={status !== "ready"}>▶ Play</button>
        )}
      </form>
      <p className="sym-hint">One number for a solo, up to {MAX_ROOM} for a room. The first Normie leads.</p>
      {voices.some((v) => v.awakened) && <p className="sym-hint">Awakened Normies add an extra layer on top.</p>}
      {skipped.length > 0 && <p className="sym-hint">Skipped (couldn&apos;t read): {skipped.map((s) => `#${s}`).join(", ")}</p>}

      <ol className="sym-playlist" aria-label={voices.length > 1 ? "Normies in this room" : "Parts in this song"}>
        {voices.length > 1
          ? voices.map((v, i) => (
              <li key={v.tokenId}>
                <span className="sym-pl-n">{i + 1}.</span>
                <span className="sym-pl-role">{i === 0 ? "LEAD" : "VOICE"}</span>
                <span className="sym-pl-inst">{v.name}</span>
                <span className="sym-pl-notes">#{v.tokenId}{v.awakened ? " +layer" : ""}</span>
              </li>
            ))
          : score?.parts.map((p, i) => (
              <li key={i}>
                <span className="sym-pl-n">{i + 1}.</span>
                <span className="sym-pl-role">{PART_LABEL[p.role] ?? p.role.toUpperCase()}</span>
                <span className="sym-pl-inst">{p.layer === "awakened" ? `${p.instrument} · awakened` : p.instrument}</span>
                <span className="sym-pl-notes">{p.notes.filter((x) => x !== "rest").length} notes</span>
              </li>
            ))}
      </ol>

      <div className="sym-share" role="group" aria-label="Share this song">
        <button type="button" className="sym-btn" onClick={copyLink} disabled={status !== "ready"}>
          {copied ? "Link copied ✓" : "Copy link"}
        </button>
        <a
          className="sym-btn"
          href={`https://x.com/intent/post?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={status !== "ready"}
        >
          Post on X
        </a>
        <a className="sym-btn" href={cardPath} download={`${fileBase}.png`} aria-disabled={status !== "ready"}>
          ⤓ PNG
        </a>
        <button type="button" className="sym-btn" onClick={download} disabled={status !== "ready" || exporting || renderingVideo}>
          {exporting ? "Rendering…" : "⤓ WAV"}
        </button>
        <button
          type="button"
          className="sym-btn"
          onClick={downloadMp4}
          disabled={status !== "ready" || !videoOk || exporting || renderingVideo}
          title={videoOk === false ? "Video export needs Chrome or Safari" : undefined}
        >
          {renderingVideo ? `Rendering… ${videoProgress}%` : "⤓ MP4"}
        </button>
        {videoFile && !renderingVideo && (
          <button type="button" className="sym-btn" onClick={shareVideo}>
            Share video
          </button>
        )}
      </div>
      {videoOk === false && <p className="sym-hint">Video export needs Chrome or Safari</p>}
      {videoFailed && <p className="sym-hint" role="status">Video export failed. Try again.</p>}
      <p className="sym-hint">
        {block
          ? `The link pins block ${block.toLocaleString("en-US")}: anyone who opens it hears these Normies exactly as they were then.`
          : "Links pin the current Ethereum block, so a song can be replayed exactly."}
      </p>
    </section>
  )
}
