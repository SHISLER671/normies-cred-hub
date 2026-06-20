import { cn } from "@/lib/utils"

interface SectionLabelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function SectionLabel({ children, className, ...props }: SectionLabelProps) {
  return (
    <div
      className={cn(
        "text-xs tracking-[1.5px] text-muted-foreground font-medium",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
