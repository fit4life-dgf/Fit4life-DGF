import { Area, AreaChart, Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useCssColors } from '../../hooks/useCssColor'
import type { DayPoint } from '../../types'

const short = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

interface BarProps { data: DayPoint[]; color: string; goal?: number; unit: string; label: string; height?: number }

/** Daily bar chart with an optional goal line. Includes a screen-reader summary table alternative via aria-label. */
export function DailyBars({ data, color, goal, unit, label, height = 180 }: BarProps) {
  const [fill, grid, text, ink] = useCssColors([color, 'line', 'ink2', 'ink'])
  const total = data.reduce((s, d) => s + d.value, 0)
  const nonEmpty = data.some((d) => d.value > 0)
  if (!nonEmpty) return <p className="rounded-tile bg-card2 p-4 text-center text-sm text-ink2">No {label.toLowerCase()} data in this period yet.</p>
  return (
    <div role="img" aria-label={`${label}: total ${total} ${unit} over ${data.length} days`} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
          <CartesianGrid stroke={grid} vertical={false} />
          <XAxis dataKey="date" tickFormatter={short} stroke={text} fontSize={11} tickLine={false} interval="preserveStartEnd" />
          <YAxis stroke={text} fontSize={11} tickLine={false} axisLine={false} />
          <Tooltip formatter={(v: number) => [`${v.toLocaleString('en-IN')} ${unit}`, label]} labelFormatter={short} contentStyle={{ borderRadius: 12, border: `1px solid ${grid}` }} />
          {goal ? <ReferenceLine y={goal} stroke={ink} strokeDasharray="4 4" strokeOpacity={0.5} /> : null}
          <Bar dataKey="value" fill={fill} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

interface LineProps { data: { date: string; value: number }[]; unit: string; label: string; height?: number }

export function TrendArea({ data, unit, label, height = 180 }: LineProps) {
  const [stroke, grid, text] = useCssColors(['accent', 'line', 'ink2'])
  if (data.length < 2) return <p className="rounded-tile bg-card2 p-4 text-center text-sm text-ink2">Log at least two {label.toLowerCase()} entries to see a trend.</p>
  const vals = data.map((d) => d.value)
  const pad = Math.max(1, (Math.max(...vals) - Math.min(...vals)) * 0.2)
  return (
    <div role="img" aria-label={`${label} trend, latest ${vals[vals.length - 1]} ${unit}`} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs><linearGradient id="trend" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={stroke} stopOpacity={0.3} /><stop offset="100%" stopColor={stroke} stopOpacity={0} /></linearGradient></defs>
          <CartesianGrid stroke={grid} vertical={false} />
          <XAxis dataKey="date" tickFormatter={short} stroke={text} fontSize={11} tickLine={false} interval="preserveStartEnd" />
          <YAxis stroke={text} fontSize={11} tickLine={false} axisLine={false} domain={[Math.floor(Math.min(...vals) - pad), Math.ceil(Math.max(...vals) + pad)]} />
          <Tooltip formatter={(v: number) => [`${v} ${unit}`, label]} labelFormatter={short} contentStyle={{ borderRadius: 12, border: `1px solid ${grid}` }} />
          <Area type="monotone" dataKey="value" stroke={stroke} strokeWidth={2.5} fill="url(#trend)" dot={{ r: 3 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
