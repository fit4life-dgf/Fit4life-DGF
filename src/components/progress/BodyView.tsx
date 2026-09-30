import { useState } from 'react'
import type { Profile } from '../../types'
import { fetchMeasurements, saveMeasurement } from '../../services/progress'
import { fetchMemberDetails } from '../../services/nutrition'
import { useAsync } from '../../hooks/useAsync'
import { bmi } from '../../utils/energy'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Sheet } from '../ui/Sheet'
import { NumberField } from '../ui/NumberField'
import { ErrorBox, LoadingBlocks, Notice } from '../ui/StateViews'
import { TrendArea } from './Charts'

export function BodyView({ profile }: { profile: Profile }) {
  const m = useAsync(() => fetchMeasurements(profile.id), [profile.id])
  const d = useAsync(() => fetchMemberDetails(profile.id), [profile.id])
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ weight: 70, fat: 0, chest: 0, waist: 0, hips: 0, arm: 0 })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const rows = m.data ?? []
  const last = rows[rows.length - 1]
  const weights = rows.filter((r) => r.weight_kg != null).map((r) => ({ date: r.measured_on, value: r.weight_kg as number }))
  const first = weights[0]?.value
  const cur = weights[weights.length - 1]?.value
  const idx = bmi(cur ?? d.data?.weight_kg ?? null, d.data?.height_cm ?? null)

  function start() {
    setF({ weight: cur ?? d.data?.weight_kg ?? 70, fat: last?.body_fat_pct ?? 0, chest: last?.chest_cm ?? 0, waist: last?.waist_cm ?? 0, hips: last?.hips_cm ?? 0, arm: last?.arm_cm ?? 0 })
    setOpen(true)
  }
  async function save() {
    setBusy(true); setErr(null)
    const opt = (n: number) => (n > 0 ? n : null)
    try {
      await saveMeasurement(profile, { weight_kg: f.weight, body_fat_pct: opt(f.fat), chest_cm: opt(f.chest), waist_cm: opt(f.waist), hips_cm: opt(f.hips), arm_cm: opt(f.arm) })
      setOpen(false); await m.reload()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not save.') } finally { setBusy(false) }
  }

  if (m.loading) return <LoadingBlocks n={2} h="h-40" />
  if (m.error) return <ErrorBox message={m.error} onRetry={() => void m.reload()} />
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-3 gap-3">
        <Card className="text-center"><p className="text-xs text-ink2">Weight</p><p className="tabular text-xl font-extrabold">{cur ?? '—'}<small className="text-xs font-medium"> kg</small></p></Card>
        <Card className="text-center"><p className="text-xs text-ink2">Change</p><p className="tabular text-xl font-extrabold">{first != null && cur != null ? (cur - first > 0 ? '+' : '') + (Math.round((cur - first) * 10) / 10) : '—'}</p></Card>
        <Card className="text-center"><p className="text-xs text-ink2">BMI</p><p className="tabular text-xl font-extrabold">{idx ?? '—'}</p></Card>
      </div>
      <Card className="grid gap-2"><h2 className="text-sm font-bold">Weight trend</h2><TrendArea data={weights} unit="kg" label="Weight" /></Card>
      {last && <Card className="grid grid-cols-2 gap-2 text-sm">{([['Body fat', last.body_fat_pct, '%'], ['Chest', last.chest_cm, 'cm'], ['Waist', last.waist_cm, 'cm'], ['Hips', last.hips_cm, 'cm'], ['Arm', last.arm_cm, 'cm']] as const).map(([l, v, u]) => <div key={l} className="flex justify-between rounded-tile bg-card2 px-3 py-2"><span className="text-ink2">{l}</span><b>{v != null ? `${v} ${u}` : '—'}</b></div>)}</Card>}
      {!rows.length && <Notice text="No weigh-ins yet. Add your first one to start your trend." />}
      <Button onClick={start}>Add weigh-in / measurements</Button>
      <Sheet open={open} title="Measurements" onClose={() => setOpen(false)}>
        <div className="grid gap-3">
          <NumberField label="Weight" value={f.weight} step={0.5} min={20} max={300} unit="kg" onChange={(n) => setF({ ...f, weight: n })} />
          <p className="text-xs text-ink2">Optional. Leave at 0 to skip.</p>
          <NumberField label="Body fat" value={f.fat} step={0.5} min={0} max={60} unit="%" onChange={(n) => setF({ ...f, fat: n })} />
          <NumberField label="Chest" value={f.chest} step={1} min={0} max={200} unit="cm" onChange={(n) => setF({ ...f, chest: n })} />
          <NumberField label="Waist" value={f.waist} step={1} min={0} max={200} unit="cm" onChange={(n) => setF({ ...f, waist: n })} />
          <NumberField label="Hips" value={f.hips} step={1} min={0} max={200} unit="cm" onChange={(n) => setF({ ...f, hips: n })} />
          <NumberField label="Arm" value={f.arm} step={0.5} min={0} max={80} unit="cm" onChange={(n) => setF({ ...f, arm: n })} />
          {err && <Notice text={err} tone="bad" />}
          <Button busy={busy} onClick={() => void save()}>Save</Button>
        </div>
      </Sheet>
    </div>
  )
}
