const STORAGE_PREFIX = "my-normie-"

export function lastSelectedNormieKey(address: string): string {
  return `${STORAGE_PREFIX}${address.toLowerCase()}`
}

export function getLastSelectedNormie(address: string): number | null {
  if (typeof window === "undefined") return null

  const saved = localStorage.getItem(lastSelectedNormieKey(address))
  if (!saved) return null

  const parsed = Number.parseInt(saved, 10)
  return Number.isFinite(parsed) ? parsed : null
}

export function setLastSelectedNormie(address: string, tokenId: number): void {
  if (typeof window === "undefined") return
  localStorage.setItem(lastSelectedNormieKey(address), String(tokenId))
}