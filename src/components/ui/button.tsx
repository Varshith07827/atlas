import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all duration-150 disabled:pointer-events-none disabled:opacity-40 active:scale-[0.97] select-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-fg text-bg hover:opacity-90 shadow-sm',
        accent: 'bg-accent text-accent-fg hover:brightness-110 shadow-sm',
        secondary:
          'bg-elevated text-fg border border-border hover:border-border-strong hover:bg-surface',
        ghost: 'text-muted hover:text-fg hover:bg-elevated',
        outline: 'border border-border text-fg hover:bg-elevated',
        danger: 'bg-danger/12 text-danger hover:bg-danger/20',
        link: 'text-accent underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 rounded-[var(--radius-sm)] px-2.5 text-[13px] [&_svg]:size-3.5',
        default: 'h-9 rounded-[var(--radius-md)] px-3.5 text-sm [&_svg]:size-4',
        lg: 'h-11 rounded-[var(--radius-md)] px-5 text-[15px] [&_svg]:size-4',
        icon: 'size-9 rounded-[var(--radius-md)] [&_svg]:size-4',
        'icon-sm': 'size-7 rounded-[var(--radius-sm)] [&_svg]:size-3.5',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />
    )
  },
)
Button.displayName = 'Button'

export { buttonVariants }
