import { Minus, Plus } from 'lucide-react'

interface Props { value: number; step: number; min: number; max: number; unit: string; onChange: (n: number) => void }
export function Stepper({ value, step, min, max, unit, onChange }: Props) {
  const set = (n: number) => onChange(Math.min(max, Math.max(min, Math.round(n * 100) / 100)))
  return (
    <div className="flex items-center gap-3">
      <button aria-label="Decrease" onClick={() => set(value - step)} className="flex h-14 w-14 items-center justify-center rounded-tile bg-card2 active:bg-line"><Minus /></button>
      <div className="flex-1 text-center"><span className="tabular text-3xl font-extrabold">{value}</span> <span className="text-sm text-ink2">{unit}</span></div>
      <button aria-label="Increase" onClick={() => set(value + step)} className="flex h-14 w-14 items-center justify-center rounded-tile bg-card2 active:bg-line"><Plus /></button>
    </div>
  )
}
