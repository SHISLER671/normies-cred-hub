// Pixel Symphony synth on the browser's built-in Web Audio (no Tone.js, no new packages). Client-only.
// One voicing per instrument family, as in the original app: Type/Accessory pick the instrument, Expression/Age/Eyes
// shape the envelope and filter (all decided in compose.ts). Deterministic: the reverb uses a seeded impulse, so the
// same score renders the same WAV.

import { scoreEvents, type NoteEvent } from "./timeline"
import type { VoicePart, VoiceScore } from "./types"
import { encodeWav } from "./wav"

type Ctx = BaseAudioContext

function seeded(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function impulse(ctx: Ctx, seconds = 2.2): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  const rnd = seeded(7141)
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c)
    for (let i = 0; i < len; i++) d[i] = (rnd() * 2 - 1) * Math.pow(1 - i / len, 2.6)
  }
  return buf
}

function noise(ctx: Ctx, seconds = 1): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const rnd = seeded(32626)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = rnd() * 2 - 1
  return buf
}

/** Shared buses for one render: master (with a soft limiter), reverb send and delay send. */
function buildBuses(ctx: Ctx, out: AudioNode, bpm: number) {
  const master = ctx.createGain()
  master.gain.value = 2.4
  const limiter = ctx.createDynamicsCompressor()
  limiter.threshold.value = -10
  limiter.ratio.value = 8
  master.connect(limiter).connect(out)

  const reverb = ctx.createConvolver()
  reverb.buffer = impulse(ctx)
  const reverbIn = ctx.createGain()
  reverbIn.connect(reverb).connect(master)

  const delay = ctx.createDelay(2)
  delay.delayTime.value = (60 / bpm) * 0.75
  const feedback = ctx.createGain()
  feedback.gain.value = 0.28
  const delayIn = ctx.createGain()
  delayIn.connect(delay)
  delay.connect(feedback).connect(delay)
  delay.connect(master)

  return { master, reverbIn, delayIn, noiseBuf: noise(ctx) }
}

export type Buses = ReturnType<typeof buildBuses>

/** Per-part channel: lowpass → pan → level, with reverb and delay sends. */
function buildChannel(ctx: Ctx, p: VoicePart, buses: Buses): AudioNode {
  const filter = ctx.createBiquadFilter()
  filter.type = "lowpass"
  filter.frequency.value = p.filterHz
  filter.Q.value = p.instrument === "bass-sub" ? 0.7 : 1.1
  const pan = ctx.createStereoPanner()
  pan.pan.value = p.pan
  const level = ctx.createGain()
  level.gain.value = Math.max(0.01, Math.min(0.9, p.gain))
  filter.connect(pan).connect(level).connect(buses.master)
  const rs = ctx.createGain()
  rs.gain.value = p.reverbSend
  level.connect(rs).connect(buses.reverbIn)
  const ds = ctx.createGain()
  ds.gain.value = p.delaySend
  level.connect(ds).connect(buses.delayIn)
  return filter
}

function osc(ctx: Ctx, type: OscillatorType, freq: number, detuneCents = 0): OscillatorNode {
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.value = freq
  o.detune.value = detuneCents
  return o
}

/** Schedule one note: sources for its instrument → ADSR envelope → the part's channel. */
function playNote(ctx: Ctx, ev: NoteEvent, p: VoicePart, dest: AudioNode, at: number, buses: Buses) {
  const start = at + ev.time
  const end = start + ev.duration
  const stopAt = end + p.release + 0.05

  // ADSR, squeezed into short notes so automation times always stay in order.
  const a = Math.min(p.attack, ev.duration * 0.5)
  const d = Math.min(p.decay, Math.max(0, ev.duration - a))
  const sus = 0.5 * Math.max(0.0001, p.sustain)
  const env = ctx.createGain()
  env.gain.setValueAtTime(0, start)
  env.gain.linearRampToValueAtTime(0.5, start + a)
  env.gain.linearRampToValueAtTime(sus, start + a + d)
  env.gain.setValueAtTime(sus, Math.max(end, start + a + d))
  env.gain.linearRampToValueAtTime(0, Math.max(end, start + a + d) + p.release)
  env.connect(dest)

  const f = ev.freq
  const sources: AudioScheduledSourceNode[] = []
  const add = (node: AudioScheduledSourceNode, gain = 1) => {
    if (gain === 1) node.connect(env)
    else {
      const g = ctx.createGain()
      g.gain.value = gain
      node.connect(g).connect(env)
    }
    sources.push(node)
  }
  const fm = (carrierType: OscillatorType, ratio: number, index: number, modType: OscillatorType) => {
    const c = osc(ctx, carrierType, f)
    const m = osc(ctx, modType, f * ratio)
    const depth = ctx.createGain()
    depth.gain.value = f * index
    m.connect(depth).connect(c.frequency)
    add(c)
    sources.push(m)
  }

  switch (p.instrument) {
    case "agent-pad":
      fm("sine", 2.5, 1.2, "triangle")
      break
    case "choir-ah":
      add(osc(ctx, "sine", f, -6), 0.6)
      add(osc(ctx, "sine", f, 6), 0.6)
      add(osc(ctx, "triangle", f * 2), 0.12)
      break
    case "alien-bell":
      fm("sine", 3.5, 2.5, "sine")
      break
    case "cat-pluck":
      add(osc(ctx, "triangle", f))
      break
    case "bass-sub":
      add(osc(ctx, "sawtooth", f, -12), 0.5)
      add(osc(ctx, "sawtooth", f, 12), 0.5)
      add(osc(ctx, "sine", f / 2), 0.5)
      break
    case "arp-pulse":
      add(osc(ctx, "square", f), 0.6)
      break
    case "glass-keys":
      add(osc(ctx, "triangle", f))
      add(osc(ctx, "sine", f * 2), 0.25)
      break
    case "noise-breath": {
      const n = ctx.createBufferSource()
      n.buffer = buses.noiseBuf
      n.loop = true
      add(n, 0.4)
      break
    }
    case "human-lead":
    default:
      add(osc(ctx, "sawtooth", f, -9), 0.45)
      add(osc(ctx, "sawtooth", f, 9), 0.45)
      break
  }

  for (const s of sources) {
    s.start(start)
    s.stop(stopAt)
  }
}

/** Schedule one full loop of the score starting at context time `at`. */
export function scheduleLoop(ctx: Ctx, score: VoiceScore, at: number, buses: Buses, channels: AudioNode[]) {
  for (const ev of scoreEvents(score)) playNote(ctx, ev, score.parts[ev.part], channels[ev.part], at, buses)
}

/** Live playback that loops until stopped. One AudioContext per player; call stop() to release it. */
export function createPlayer(score: VoiceScore) {
  const ctx = new AudioContext()
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 256
  analyser.smoothingTimeConstant = 0.7
  analyser.connect(ctx.destination)
  const buses = buildBuses(ctx, analyser, score.bpm)
  const channels = score.parts.map((p) => buildChannel(ctx, p, buses))
  let next = ctx.currentTime + 0.12
  const started = next
  scheduleLoop(ctx, score, next, buses, channels)
  next += score.loopSeconds
  const timer = setInterval(() => {
    if (ctx.currentTime > next - 1.5) {
      scheduleLoop(ctx, score, next, buses, channels)
      next += score.loopSeconds
    }
  }, 250)
  return {
    /** Live spectrum for the EQ bars: fills `out` (length analyser.frequencyBinCount) with 0–255 levels. */
    spectrum: (out: Uint8Array<ArrayBuffer>) => analyser.getByteFrequencyData(out),
    bins: analyser.frequencyBinCount,
    /** Seconds since the first loop began (for the playhead). */
    elapsed: () => Math.max(0, ctx.currentTime - started),
    stop: () => {
      clearInterval(timer)
      buses.master.gain.setTargetAtTime(0, ctx.currentTime, 0.05)
      setTimeout(() => void ctx.close(), 300)
    },
  }
}

/** Render one loop (plus the reverb tail) offline and return the stereo AudioBuffer. Used by the WAV and MP4 exports. */
export async function renderBuffer(score: VoiceScore, sampleRate = 44100): Promise<AudioBuffer> {
  const seconds = score.loopSeconds + 2.5
  const ctx = new OfflineAudioContext(2, Math.ceil(sampleRate * seconds), sampleRate)
  const buses = buildBuses(ctx, ctx.destination, score.bpm)
  const channels = score.parts.map((p) => buildChannel(ctx, p, buses))
  scheduleLoop(ctx, score, 0.05, buses, channels)
  return ctx.startRendering()
}

/** Render one loop (plus the reverb tail) offline and return it as a 16-bit stereo WAV. */
export async function renderWav(score: VoiceScore, sampleRate = 44100): Promise<Blob> {
  const buf = await renderBuffer(score, sampleRate)
  const bytes = encodeWav([buf.getChannelData(0), buf.getChannelData(1)], sampleRate)
  return new Blob([bytes.buffer as ArrayBuffer], { type: "audio/wav" })
}
