import * as React from 'react'
import * as LabelPrimitive from '@radix-ui/react-label'
import { cn } from '@/lib/utils'

const base =
  'w-full bg-elevated border border-border rounded-[var(--radius-md)] px-3 text-sm text-fg placeholder:text-faint transition-colors focus:outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/15 disabled:opacity-50'

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(base, 'h-9', className)} {...props} />
  ),
)
Input.displayName = 'Input'

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(base, 'py-2 resize-none leading-relaxed', className)} {...props} />
  ),
)
Textarea.displayName = 'Textarea'

/**
 * A textarea that grows with its content — used for note bodies and task
 * descriptions, where a fixed height means either wasted space or a scrollbar
 * inside a scrollbar.
 */
export const AutoTextarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<'textarea'> & { minRows?: number }
>(({ className, minRows = 2, onChange, ...props }, forwarded) => {
  const inner = React.useRef<HTMLTextAreaElement | null>(null)

  const resize = React.useCallback(() => {
    const el = inner.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [])

  React.useLayoutEffect(resize, [resize, props.value])

  return (
    <textarea
      ref={(node) => {
        inner.current = node
        if (typeof forwarded === 'function') forwarded(node)
        else if (forwarded) forwarded.current = node
      }}
      rows={minRows}
      onChange={(e) => {
        onChange?.(e)
        resize()
      }}
      className={cn(base, 'py-2 resize-none leading-relaxed overflow-hidden', className)}
      {...props}
    />
  )
})
AutoTextarea.displayName = 'AutoTextarea'

export const Label = React.forwardRef<
  React.ComponentRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn('text-[13px] font-medium text-muted', className)}
    {...props}
  />
))
Label.displayName = 'Label'

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label?: string
  hint?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && <Label>{label}</Label>}
      {children}
      {hint && <p className="text-xs text-faint leading-relaxed">{hint}</p>}
    </div>
  )
}
