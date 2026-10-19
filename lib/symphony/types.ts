// Pixel Symphony score types. Ported from SHISLER671/pixelsymphony lib/types.ts (skins and wallet types dropped).

export type VoiceRole = "primary" | "harmony" | "counter" | "pad" | "bass" | "arp"

/** Instrument families: Type / Accessory pick these. Rendered with the browser's Web Audio (no extra packages). */
export type InstrumentId =
  | "agent-pad"
  | "human-lead"
  | "cat-pluck"
  | "alien-bell"
  | "choir-ah"
  | "bass-sub"
  | "arp-pulse"
  | "glass-keys"
  | "noise-breath"

export type ScaleName = "major" | "minor" | "pentatonic" | "phrygian" | "wholetone" | "dorian" | "mixolydian"

export interface NormieTrait {
  trait_type: string
  value: string | number
}

/** One Normie as the composer sees it: live pixels (n×n, row-major "0"/"1") and its fixed traits. */
export interface NormieVoiceInput {
  tokenId: number
  name: string
  pixels: string
  traits: NormieTrait[]
}

export interface VoicePart {
  role: VoiceRole
  instrument: InstrumentId
  notes: string[]
  durations: number[]
  filterHz: number
  gain: number
  attack: number
  decay: number
  sustain: number
  release: number
  pan: number
  reverbSend: number
  delaySend: number
  tokenId: number
  /** Seconds into the loop before this part enters. */
  startOffset: number
}

export interface VoiceScore {
  bpm: number
  root: string
  scale: ScaleName
  parts: VoicePart[]
  synopsis: string
  /** Always deterministic from on-chain pixels + traits. */
  source: "onchain"
  loopSeconds: number
}

/** Browser CPU safety for large rooms (P1). */
export const MAX_AUDIO_PARTS = 18
