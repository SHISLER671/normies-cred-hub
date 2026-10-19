"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { composeScore, gridSide } from "@/lib/symphony/compose"
import { playheadColumn } from "@/lib/symphony/timeline"
import type { NormieTrait, VoiceScore } from "@/lib/symphony/types"

type Voice = { tokenId: number; name: string; pixels: string; gridSize: number; traits: NormieTrait[] }
type Player = { stop: () => void; elapsed: () => number; spectrum: (out: Uint8Array<ArrayBuffer>) => void; bins: number }

const PART_LABEL: Record<string, string> = { pad: "PAD", bass: "BASS", primary: "LEAD", harmony: "HARMONY", arp: "ARP", counter: "COUNTER" }

function mmss(s: number): string {
  const t = Math.max(0, Math.floor(s))
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`
}

/**
 * Pixel Symphony P0: one Normie, one blip. Type a number, press play, hear its pixels; download the loop as a WAV.
 * Read-only: one cached GET for pixels + traits, everything else runs in the browser. Nothing is saved.
 */
export function SymphonyPlayer({ defaultTokenId = 7141 }: { defaultTokenId?: number }) {
  const [raw, setRaw] = useState(String(defaultTokenId))
  const [voice, setVoice] = useState<Voice | null>(null)
  const [score, setScore] = useState<VoiceScore | null>(null)
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [error, setError] = useState("")
  const [playing, setPlaying] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [exporting, setExporting] = useState(false)

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
    async (id: number) => {
      stop()
      setStatus("loading")
      setError("")
      try {
        const r = await fetch(`/api/symphony/voice/${id}`)
        const data = await r.json()
        if (!r.ok) throw new Error(data?.error ?? `Couldn't load #${id}`)
        const v = data as Voice
        setVoice(v)
        setScore(composeScore([v]))
        setStatus("ready")
      } catch (e) {
        setStatus("error")
        setError(e instanceof Error ? e.message : `Couldn't load #${id}`)
      }
    },
    [stop],
  )

  useEffect(() => {
    void load(defaultTokenId)
    return () => stop()
  }, [defaultTokenId, load, stop])

  // Draw the Normie's pixels, with the playing column inverted.
  const drawGrid = useCallback(
    (col: number | null) => {
      const c = gridRef.current
      if (!c || !voice) return
      const n = gridSide(voice.pixels)
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
      for (let i = 0; i < voice.pixels.length; i++) if (voice.pixels[i] === "1") g.fillRect(i % n, Math.floor(i / n), 1, 1)
      if (col !== null) {
        for (let y = 0; y < n; y++) {
          g.fillStyle = voice.pixels[y * n + col] === "1" ? paper : ink
          g.fillRect(col, y, 1, 1)
        }
      }
    },
    [voice],
  )

  useEffect(() => drawGrid(null), [drawGrid])

  const play = useCallback(async () => {
    if (!score || !voice) return
    stop()
    const { createPlayer } = await import("@/lib/symphony/synth")
    const p = createPlayer(score)
    player.current = p
    setPlaying(true)
    const bins = new Uint8Array(p.bins)
    const n = gridSide(voice.pixels)
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
        const css = getComputedStyle(eq)
        g.clearRect(0, 0, eq.width, eq.height)
        g.fillStyle = css.getPropertyValue("--sym-lcd-ink").trim() || "#e3e5e4"
        for (let b = 0; b < bars; b++) {
          const v = bins[Math.floor((b / bars) * (bins.length * 0.6))] / 255
          const blocks = Math.round(v * 8)
          for (let k = 0; k < blocks; k++) g.fillRect(b * cols + 1, eq.height - (k + 1) * (eq.height / 8) + 1, cols - 2, eq.height / 8 - 2)
        }
      }
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
  }, [score, voice, stop, drawGrid])

  const download = useCallback(async () => {
    if (!score || !voice) return
    setExporting(true)
    try {
      const { renderWav } = await import("@/lib/symphony/synth")
      const blob = await renderWav(score)
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = `normie-${voice.tokenId}-pixel-symphony.wav`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 5000)
    } finally {
      setExporting(false)
    }
  }, [score, voice])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const n = Number.parseInt(raw, 10)
    if (Number.isInteger(n) && n >= 0 && n <= 9999) void load(n)
  }

  const loop = score?.loopSeconds ?? 0
  const marquee = score && voice ? `${voice.name.toUpperCase()} · ${score.root} ${score.scale.toUpperCase()} · ${score.bpm} BPM` : ""

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
          <div className="sym-lcd-id">{voice ? `#${voice.tokenId}` : "#----"}</div>
          <div className="sym-lcd-marquee">
            <span>{status === "error" ? error.toUpperCase() : status === "loading" ? "READING PIXELS…" : marquee}</span>
          </div>
          <canvas ref={eqRef} className="sym-eq" width={240} height={48} aria-hidden />
        </div>

        <div className="sym-face">
          <canvas ref={gridRef} className="sym-grid" aria-label={voice ? `${voice.name}'s pixels; the playing column is inverted` : "Normie pixels"} />
        </div>
      </div>

      <form className="sym-controls" onSubmit={submit}>
        <label className="sr-only" htmlFor="sym-id">Normie number, 0 to 9999</label>
        <span className="sym-hash" aria-hidden>#</span>
        <input
          id="sym-id"
          className="sym-input"
          inputMode="numeric"
          value={raw}
          onChange={(e) => setRaw(e.target.value.replace(/[^\d]/g, "").slice(0, 4))}
        />
        <button type="submit" className="sym-btn">Load</button>
        {playing ? (
          <button type="button" className="sym-btn" onClick={stop}>■ Stop</button>
        ) : (
          <button type="button" className="sym-btn sym-btn-cta" onClick={play} disabled={status !== "ready"}>▶ Play</button>
        )}
        <button type="button" className="sym-btn" onClick={download} disabled={status !== "ready" || exporting}>
          {exporting ? "Rendering…" : "⤓ WAV"}
        </button>
      </form>

      <ol className="sym-playlist" aria-label="Parts in this song">
        {score?.parts.map((p, i) => (
          <li key={i}>
            <span className="sym-pl-n">{i + 1}.</span>
            <span className="sym-pl-role">{PART_LABEL[p.role] ?? p.role.toUpperCase()}</span>
            <span className="sym-pl-inst">{p.instrument}</span>
            <span className="sym-pl-notes">{p.notes.filter((x) => x !== "rest").length} notes</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
