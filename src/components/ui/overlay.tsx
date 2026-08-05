import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close
export const DialogTitle = DialogPrimitive.Title
export const DialogDescription = DialogPrimitive.Description

const Overlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]',
      'data-[state=open]:animate-[fade_0.2s_ease] data-[state=closed]:opacity-0 data-[state=closed]:transition-opacity',
      className,
    )}
    {...props}
  />
))
Overlay.displayName = 'DialogOverlay'

export const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    hideClose?: boolean
  }
>(({ className, children, hideClose, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <Overlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2',
        'bg-surface border border-border rounded-[var(--radius-xl)] shadow-2xl shadow-black/40',
        'focus:outline-none data-[state=open]:animate-[pop_0.2s_var(--ease-spring)]',
        // On phones a centred modal fights the keyboard; cap it and let it scroll.
        'max-h-[min(85dvh,44rem)] overflow-y-auto',
        className,
      )}
      {...props}
    >
      {children}
      {!hideClose && (
        <DialogPrimitive.Close
          className="absolute right-3 top-3 size-7 grid place-items-center rounded-[var(--radius-sm)] text-faint hover:text-fg hover:bg-elevated transition-colors"
          aria-label="Close"
        >
          <X className="size-4" />
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
))
DialogContent.displayName = 'DialogContent'

export function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('px-5 pt-5 pb-3 space-y-1', className)} {...props} />
}

export function DialogBody({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('px-5 pb-5 space-y-4', className)} {...props} />
}

export function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-5 py-4 border-t border-border',
        className,
      )}
      {...props}
    />
  )
}

/* -------------------------------------------------------------------------- */
/*  Sheet — same primitive, edge-anchored. Task detail uses this on mobile.    */
/* -------------------------------------------------------------------------- */

const sheetVariants = cva(
  'fixed z-50 bg-surface border-border shadow-2xl shadow-black/40 focus:outline-none transition-transform duration-300 ease-[var(--ease-out-quint)]',
  {
    variants: {
      side: {
        right:
          'inset-y-0 right-0 w-full sm:max-w-md border-l data-[state=closed]:translate-x-full data-[state=open]:translate-x-0',
        left: 'inset-y-0 left-0 w-[85vw] max-w-72 border-r data-[state=closed]:-translate-x-full data-[state=open]:translate-x-0',
        bottom:
          'inset-x-0 bottom-0 max-h-[88dvh] rounded-t-[var(--radius-2xl)] border-t data-[state=closed]:translate-y-full data-[state=open]:translate-y-0',
      },
    },
    defaultVariants: { side: 'right' },
  },
)

export const Sheet = DialogPrimitive.Root
export const SheetTrigger = DialogPrimitive.Trigger
export const SheetClose = DialogPrimitive.Close
export const SheetTitle = DialogPrimitive.Title
export const SheetDescription = DialogPrimitive.Description

export const SheetContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> &
    VariantProps<typeof sheetVariants> & { hideClose?: boolean }
>(({ side = 'right', className, children, hideClose, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <Overlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(sheetVariants({ side }), 'flex flex-col', className)}
      {...props}
    >
      {side === 'bottom' && (
        <div className="mx-auto mt-2.5 h-1 w-9 rounded-full bg-border-strong shrink-0" />
      )}
      {children}
      {!hideClose && (
        <DialogPrimitive.Close
          className="absolute right-3 top-3 size-8 grid place-items-center rounded-[var(--radius-sm)] text-faint hover:text-fg hover:bg-elevated transition-colors"
          aria-label="Close"
        >
          <X className="size-4" />
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
))
SheetContent.displayName = 'SheetContent'

/**
 * Confirmation for destructive actions. Deliberately plain: a dialog you have
 * to read is better than an undo you have to discover.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Delete',
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel?: string
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" hideClose>
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
          {description && (
            <DialogDescription className="text-sm text-muted leading-relaxed">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            className="h-9 px-4 rounded-[var(--radius-md)] text-sm font-medium text-muted hover:text-fg hover:bg-elevated transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
            className="h-9 px-4 rounded-[var(--radius-md)] text-sm font-medium bg-danger text-white hover:brightness-110 transition-all active:scale-[0.97]"
          >
            {confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
