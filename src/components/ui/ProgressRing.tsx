import type { ReactNode } from 'react'
import type { MetricColor } from '../../types'
import { STROKE } from './colors'

interface Props {
  value: number // 0-100
  size?: number
  stroke?: number
  color: MetricColor
  label: string
  children?: ReactNode
}

export function ProgressRing({ value, size = 160, stroke = 12, color, label, children }: Props) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.min(100, Math.max(0, value))
  return (
    <div className="relative" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-line" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
          className={`${STROKE[color]} transition-[stroke-dashoffset] duration-700 ease-out`}
          strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  )
}
