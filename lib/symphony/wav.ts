// 16-bit PCM WAV encoder (plays everywhere). Ported from SHISLER671/pixelsymphony lib/blip-export.ts, but takes raw
// channel arrays so it is pure and testable without a browser AudioBuffer.

export function encodeWav(channels: Float32Array[], sampleRate: number): Uint8Array {
  const numChannels = channels.length
  const samples = channels[0]?.length ?? 0
  const blockAlign = numChannels * 2
  const dataSize = samples * blockAlign
  const buf = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buf)
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i))
  }
  str(0, "RIFF")
  view.setUint32(4, 36 + dataSize, true)
  str(8, "WAVE")
  str(12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)
  str(36, "data")
  view.setUint32(40, dataSize, true)
  let o = 44
  for (let i = 0; i < samples; i++) {
    for (let c = 0; c < numChannels; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i] ?? 0))
      view.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true)
      o += 2
    }
  }
  return new Uint8Array(buf)
}
