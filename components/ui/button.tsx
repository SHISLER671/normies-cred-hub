import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-[var(--radius)] border border-transparent text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/30 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90 border-primary',
        outline:
          'border-border bg-transparent hover:bg-primary hover:text-background',
        secondary:
          'bg-secondary text-secondary-foreground border-border hover:bg-muted',
        ghost:
          'hover:bg-muted hover:text-foreground',
        destructive:
          'border-destructive/30 bg-transparent text-destructive hover:bg-destructive hover:text-white',
        link: 'text-primary underline-offset-2 hover:underline',
      },
      size: {
        default: 'min-h-[44px] h-9 gap-2 px-4',
        sm: 'min-h-[40px] h-8 gap-1.5 px-3 text-xs',
        lg: 'min-h-[48px] h-10 gap-3 px-5 text-base',
        icon: 'size-9 min-h-[44px]',
        'icon-sm': 'size-8 min-h-[40px]',
        'icon-lg': 'size-10 min-h-[48px]',
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
