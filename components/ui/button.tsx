import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-none border text-sm font-medium whitespace-nowrap transition-all outline-none select-none active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/30 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Primary / main action — uses refined purple + subtle glow
        default: 'bg-primary text-primary-foreground border-primary hover:bg-primary/90 glow-primary',
        // Secondary — solid but lower emphasis
        secondary: 'bg-secondary text-foreground border-border hover:bg-muted/80',
        // Outline — clean, sophisticated
        outline: 'border-border bg-transparent hover:bg-card hover:text-foreground text-foreground',
        // Ghost — minimal
        ghost: 'border-transparent hover:bg-muted hover:text-foreground text-foreground',
        // Destructive
        destructive: 'border-destructive/30 bg-transparent text-destructive hover:bg-destructive hover:text-white',
        // Link style
        link: 'text-primary underline-offset-2 hover:underline border-transparent',
      },
      size: {
        default: 'min-h-[44px] h-9 gap-2 px-5',
        sm: 'min-h-[38px] h-8 gap-1.5 px-3.5 text-xs',
        lg: 'min-h-[50px] h-11 gap-3 px-6 text-base',
        icon: 'size-10 min-h-[44px]',
        'icon-sm': 'size-9 min-h-[38px]',
        'icon-lg': 'size-11 min-h-[50px]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
