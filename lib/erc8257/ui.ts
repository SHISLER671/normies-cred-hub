import type { RegistryToolAccess } from "@/lib/erc8257/types"

export type AccessBadge = {
  label: string
  variant: "open" | "gated" | "mismatch" | "usable" | "blocked" | "unchecked"
}

export function getAccessBadge(access: RegistryToolAccess): AccessBadge {
  if (access.manifestAccessMismatch) {
    return { label: "Gate mismatch", variant: "mismatch" }
  }
  if (access.accessGranted === true) {
    return { label: "You can use", variant: "usable" }
  }
  if (access.accessGranted === false) {
    return { label: "Gated for you", variant: "blocked" }
  }
  if (access.openAccess) {
    return { label: "Open access", variant: "open" }
  }
  if (access.accessGranted === null) {
    return { label: "Not checked", variant: "unchecked" }
  }
  return { label: "Gated", variant: "gated" }
}

export function accessBadgeClass(variant: AccessBadge["variant"]): string {
  switch (variant) {
    case "open":
      return "bg-primary/15 text-primary border-primary/30"
    case "usable":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
    case "gated":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
    case "blocked":
      return "bg-destructive/10 text-destructive border-destructive/30"
    case "unchecked":
      return "bg-muted text-muted-foreground border-border"
    case "mismatch":
      return "bg-destructive/10 text-destructive border-destructive/30"
  }
}