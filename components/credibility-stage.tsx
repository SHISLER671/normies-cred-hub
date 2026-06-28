import type { CredibilitySignal } from "@/lib/types"
import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

export function CredibilityStage({
  icon: Icon,
  title,
  description,
  signal,
  children,
}: {
  icon: LucideIcon
  title: string
  description: string
  signal?: CredibilitySignal | null
  children: ReactNode
}) {
  return (
    <div className="cred-stage">
      <div>
        <div className="flex h-8 w-8 items-center justify-center rounded-none border border-primary bg-primary/10">
          <Icon className="size-4 text-primary" />
        </div>
      </div>
      <div className="cred-content">
        <div className="font-medium mb-1">{signal?.title ?? title}</div>
        <p className="text-sm text-muted-foreground mb-2">
          {signal?.description ?? description}
        </p>
        <div className="cred-data">{children}</div>
      </div>
    </div>
  )
}

export function CredibilityConnector() {
  return <div className="cred-connector h-4" />
}