/** Small display helpers shared across the dashboard. */

export function shortenAddress(address?: string | null, chars = 4): string {
  if (!address) return "—"
  if (address.length < 2 + chars * 2) return address
  return `${address.slice(0, 2 + chars)}…${address.slice(-chars)}`
}

export function formatDate(iso?: string): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function etherscanAddress(address: string): string {
  return `https://etherscan.io/address/${address}`
}

export function etherscanTx(hash: string): string {
  return `https://etherscan.io/tx/${hash}`
}

export function ensAppUrl(name: string): string {
  return `https://app.ens.domains/${name}`
}
