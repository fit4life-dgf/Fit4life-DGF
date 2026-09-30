import type { ReactNode } from 'react'
import type { MetricColor } from '../../types'
import { TINT, TINT_SOFT } from '../ui/colors'

interface Props {
  color: MetricColor
  icon: ReactNode
  label: string
  value: string | null
  unit?: string
  sub?: string
  progress?: number // 0-100
  onClick?: () => void
  children?: ReactNode
  className?: string
}

/** Reusable pastel metric tile. Shows an em dash when there is no data (never a fake number). */
export function MetricCard({ color, icon, label, value, unit, sub, progress, onClick, children, className = '' }: Props) {
  const body = (
    <>
      <div className="flex items-center gap-2 text-sm font-semibold text-ink/80">
        <span className={`flex h-8 w-8 items-center justify-center rounded-full ${TINT_SOFT[color]} text-ink`}>{icon}</span>
        {label}
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="tabular text-2xl font-extrabold text-ink">{value ?? '—'}</span>
        {value != null && unit && <span className="text-sm font-medium text-ink/70">{unit}</span>}
      </div>
      {sub && <p className="mt-0.5 text-xs text-ink/70">{sub}</p>}
      {progress != null && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/10" role="progressbar" aria-label={`${label} progress`} aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
          <div className={`h-full rounded-full bg-ink/60 transition-[width] duration-700`} style={{ width: `${Math.min(100, progress)}%` }} />
        </div>
      )}
      {children}
    </>
  )
  const cls = `rounded-card p-4 text-left animate-rise ${TINT[color]} ${className}`
  return onClick
    ? <button onClick={onClick} className={`${cls} block w-full`}>{body}</button>
    : <div className={cls}>{body}</div>
}
