import { Minus, Plus } from 'lucide-react'

interface Props { label: string; value: number; step: number; min: number; max: number; unit?: string; onChange: (n: number) => void }

/** Compact tap-to-adjust number control for forms. */
export function NumberField({ label, value, step, min, max, unit, onChange }: Props) {
  const set = (n: number) => onChange(Math.min(max, Math.max(min, Math.round(n * 100) / 100)))
  return (
    <div className="flex items-center justify-between gap-3 rounded-tile bg-card2 px-3 py-2">
      <span className="text-sm font-semibold">{label}</span>
      <div className="flex items-center gap-2">
        <button type="button" aria-label={`Decrease ${label}`} onClick={() => set(value - step)} className="flex h-10 w-10 items-center justify-center rounded-full bg-card"><Minus size={16} /></button>
        <span className="tabular w-16 text-center text-base font-extrabold">{value}{unit ? <small className="ml-0.5 text-xs font-medium text-ink2">{unit}</small> : null}</span>
        <button type="button" aria-label={`Increase ${label}`} onClick={() => set(value + step)} className="flex h-10 w-10 items-center justify-center rounded-full bg-card"><Plus size={16} /></button>
      </div>
    </div>
  )
}

export function ChoiceRow<T extends string>({ label, value, options, onChange }: { label: string; value: T | null; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-semibold">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)}
            className={`min-h-[44px] rounded-full px-4 text-sm font-semibold ${value === o.id ? 'bg-accent text-white' : 'bg-card2 text-ink'}`}>{o.label}</button>
        ))}
      </div>
    </div>
  )
}
