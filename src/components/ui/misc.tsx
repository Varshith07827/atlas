import * as React from 'react'
import { cn, initials, stringToHue } from '@/lib/utils'
import { ICON_REGISTRY } from './icon-registry'

export function Badge({
  className,
  color,
  children,
  ...props
}: React.ComponentProps<'span'> & { color?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium leading-none',
        !color && 'bg-elevated text-muted border border-border',
        className,
      )}
      style={
        color
          ? {
              color,
              background: `color-mix(in oklab, ${color} 14%, transparent)`,
              border: `1px solid color-mix(in oklab, ${color} 26%, transparent)`,
            }
          : undefined
      }
      {...props}
    >
      {children}
    </span>
  )
}

export function Avatar({
  name,
  email,
  src,
  size = 28,
  className,
}: {
  name?: string | null
  email?: string
  src?: string | null
  size?: number
  className?: string
}) {
  const seed = email || name || '?'
  const hue = stringToHue(seed)
  if (src) {
    return (
      <img
        src={src}
        alt={name ?? email ?? ''}
        width={size}
        height={size}
        className={cn('rounded-full object-cover shrink-0', className)}
      />
    )
  }
  return (
    <span
      className={cn(
        'grid place-items-center rounded-full font-semibold shrink-0 select-none',
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `oklch(32% 0.07 ${hue})`,
        color: `oklch(88% 0.09 ${hue})`,
      }}
      aria-hidden
    >
      {initials(name, email)}
    </span>
  )
}

export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('animate-pulse rounded-[var(--radius-md)] bg-elevated', className)}
      {...props}
    />
  )
}

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-border bg-elevated px-1.5 font-sans text-[10px] font-medium text-faint',
        className,
      )}
    >
      {children}
    </kbd>
  )
}

/**
 * Icon by name, so projects and habits can store their icon as a string.
 * Falls back to a neutral shape rather than crashing on an unknown name —
 * an icon removed from the registry shouldn't take a page down with it.
 */
export function Icon({
  name,
  className,
  ...props
}: { name: string | null | undefined } & Omit<React.ComponentProps<'svg'>, 'name'>) {
  const Cmp = (name && ICON_REGISTRY[name]) || ICON_REGISTRY.Circle
  return <Cmp className={className} {...props} />
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: string
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center px-6 py-14 animate-[in-up_0.3s_var(--ease-out-quint)]',
        className,
      )}
    >
      {icon && (
        <div className="mb-4 grid size-12 place-items-center rounded-[var(--radius-lg)] bg-elevated border border-border">
          <Icon name={icon} className="size-5 text-faint" />
        </div>
      )}
      <p className="text-[15px] font-medium text-fg">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-xs text-[13px] leading-relaxed text-muted">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/** Progress ring used by habits. Stroke-dash maths beats a rotating overlay. */
export function Ring({
  ratio,
  size = 40,
  stroke = 3.5,
  color = 'var(--color-accent)',
  children,
}: {
  ratio: number
  size?: number
  stroke?: number
  color?: string
  children?: React.ReactNode
}) {
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  return (
    <span className="relative grid place-items-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - Math.min(1, Math.max(0, ratio)))}
          style={{ transition: 'stroke-dashoffset 0.4s var(--ease-out-quint)' }}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center">{children}</span>
    </span>
  )
}

export function SectionTitle({
  children,
  count,
  action,
  className,
}: {
  children: React.ReactNode
  count?: number
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-2 mb-2.5', className)}>
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
        {children}
      </h2>
      {count !== undefined && count > 0 && (
        <span className="text-[11px] font-medium text-faint tabular-nums">{count}</span>
      )}
      {action && <div className="ml-auto">{action}</div>}
    </div>
  )
}
