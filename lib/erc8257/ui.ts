import type { RegistryToolAccess } from "@/lib/erc8257/types"

export type AccessBadge = {
  label: string
  variant: "open" | "gated" | "mismatch"
}

export function getAccessBadge(access: RegistryToolAccess): AccessBadge {
  if (access.manifestAccessMismatch) {
    return { label: "Gate mismatch", variant: "mismatch" }
  }
  if (access.openAccess) {
    return { label: "Open access", variant: "open" }
  }
  return { label: "Gated", variant: "gated" }
}

export function accessBadgeClass(variant: AccessBadge["variant"]): string {
  switch (variant) {
    case "open":
      return "bg-primary/15 text-primary border-primary/30"
    case "gated":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
    case "mismatch":
      return "bg-destructive/10 text-destructive border-destructive/30"
  }
}