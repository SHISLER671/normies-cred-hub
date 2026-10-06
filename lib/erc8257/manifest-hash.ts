// The ERC-8257 manifest hash, computed exactly like the OpenSea ToolRegistry expects: keccak256 of the JCS (RFC 8785)
// canonical JSON. Pure TypeScript with no dependencies, so the drift test and the registration helper agree byte for byte.
//
// Verified 2026-10-06: the original normies-paths.json (commit 96ff065) hashes to 0xead3879f…7aab, exactly the manifestHash
// stored on chain for Paths (Ethereum #215, Base #530, Abstract #2).

/** RFC 8785 canonical JSON. Supports what manifests use: objects, arrays, strings, booleans, null and integers. */
export function canonicalJson(value: unknown): string {
  if (value === null) return "null"
  if (typeof value === "boolean") return value ? "true" : "false"
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("JCS: non-finite number")
    if (!Number.isInteger(value)) throw new Error("JCS: fractional numbers need RFC 8785 number formatting; manifests here use integers only")
    return String(value)
  }
  if (typeof value === "string") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  if (typeof value === "object") {
    // RFC 8785 sorts keys by UTF-16 code units, which is what JavaScript's default string comparison does.
    const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined)
    entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`
  }
  throw new Error(`JCS: unsupported value of type ${typeof value}`)
}

// ── keccak256 (the original Keccak padding Ethereum uses, not NIST SHA3) ────────────────────────────────────────────────────
const RC = [
  "0000000000000001", "0000000000008082", "800000000000808a", "8000000080008000", "000000000000808b", "0000000080000001",
  "8000000080008081", "8000000000008009", "000000000000008a", "0000000000000088", "0000000080008009", "000000008000000a",
  "000000008000808b", "800000000000008b", "8000000000008089", "8000000000008003", "8000000000008002", "8000000000000080",
  "000000000000800a", "800000008000000a", "8000000080008081", "8000000000008080", "0000000080000001", "8000000080008008",
].map((h) => BigInt("0x" + h))
const ROT = [
  [0, 36, 3, 41, 18], [1, 44, 10, 45, 2], [62, 6, 43, 15, 61], [28, 55, 25, 21, 56], [27, 20, 39, 8, 14],
]
const MASK = (BigInt(1) << BigInt(64)) - BigInt(1)
const rotl = (x: bigint, n: number) => (n === 0 ? x : ((x << BigInt(n)) | (x >> BigInt(64 - n))) & MASK)

function permute(A: bigint[][]): bigint[][] {
  for (const rc of RC) {
    const C = [0, 1, 2, 3, 4].map((x) => A[x][0] ^ A[x][1] ^ A[x][2] ^ A[x][3] ^ A[x][4])
    const D = [0, 1, 2, 3, 4].map((x) => C[(x + 4) % 5] ^ rotl(C[(x + 1) % 5], 1))
    A = A.map((col, x) => col.map((v) => v ^ D[x]))
    const B: bigint[][] = [0, 1, 2, 3, 4].map(() => [BigInt(0), BigInt(0), BigInt(0), BigInt(0), BigInt(0)])
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) B[y][(2 * x + 3 * y) % 5] = rotl(A[x][y], ROT[x][y])
    A = [0, 1, 2, 3, 4].map((x) => [0, 1, 2, 3, 4].map((y) => B[x][y] ^ (~B[(x + 1) % 5][y] & MASK & B[(x + 2) % 5][y])))
    A[0][0] ^= rc
  }
  return A
}

export function keccak256Hex(bytes: Uint8Array): string {
  const rate = 136
  const len = bytes.length + 1
  const padded = new Uint8Array(Math.ceil(len / rate) * rate)
  padded.set(bytes)
  padded[bytes.length] = 0x01
  padded[padded.length - 1] |= 0x80
  let A: bigint[][] = [0, 1, 2, 3, 4].map(() => [BigInt(0), BigInt(0), BigInt(0), BigInt(0), BigInt(0)])
  for (let off = 0; off < padded.length; off += rate) {
    for (let j = 0; j < rate / 8; j++) {
      let lane = BigInt(0)
      for (let b = 7; b >= 0; b--) lane = (lane << BigInt(8)) | BigInt(padded[off + j * 8 + b])
      A[j % 5][Math.floor(j / 5)] ^= lane
    }
    A = permute(A)
  }
  let out = ""
  for (let j = 0; j < 4; j++) {
    let lane = A[j % 5][Math.floor(j / 5)]
    for (let b = 0; b < 8; b++) {
      out += Number(lane & BigInt(0xff)).toString(16).padStart(2, "0")
      lane >>= BigInt(8)
    }
  }
  return "0x" + out
}

/** The manifestHash to register for a manifest object (or its JSON text). */
export function manifestHash(manifest: unknown): string {
  const obj = typeof manifest === "string" ? JSON.parse(manifest) : manifest
  return keccak256Hex(new TextEncoder().encode(canonicalJson(obj)))
}
