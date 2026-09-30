import { useState } from 'react'
import { Sheet } from '../ui/Sheet'
import { Chips } from '../ui/Chips'
import { Stepper } from '../ui/Stepper'
import { Button } from '../ui/Button'
import type { MetricType, Profile } from '../../types'
import { logMetric, logSleep, logWater } from '../../services/health'

type Kind = 'steps' | 'water' | 'calories' | 'heart' | 'sleep'
interface Props { open: boolean; kind: Kind; profile: Profile; onClose: () => void; onSaved: () => void }

const TITLES: Record<Kind, string> = { steps: 'Add steps', water: 'Add water', calories: 'Add calories burned', heart: 'Log heart rate', sleep: 'Log last night’s sleep' }

export function LogSheet({ open, kind, profile, onClose, onSaved }: Props) {
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [hr, setHr] = useState(72)
  const [hours, setHours] = useState(7.5)

  async function run(fn: () => Promise<void>) {
    setBusy(true); setErr(null)
    try { await fn(); onSaved(); onClose() } catch (e) { setErr(e instanceof Error ? e.message : 'Could not save.') } finally { setBusy(false) }
  }
  const metric = (t: MetricType, v: number, u: string) => run(() => logMetric(profile, t, v, u))

  return (
    <Sheet open={open} title={TITLES[kind]} onClose={onClose}>
      <div className="grid gap-4">
        {kind === 'steps' && <Chips options={[500, 1000, 2000, 5000]} onPick={(n) => void metric('steps', n, 'count')} suffix=" steps" />}
        {kind === 'water' && <Chips options={[200, 250, 500, 750]} onPick={(n) => void run(() => logWater(profile, n))} suffix=" ml" />}
        {kind === 'calories' && <Chips options={[50, 100, 200, 300]} onPick={(n) => void metric('calories_burned', n, 'kcal')} suffix=" kcal" />}
        {kind === 'heart' && (<><Stepper value={hr} step={1} min={30} max={220} unit="bpm" onChange={setHr} /><Button busy={busy} onClick={() => void metric('heart_rate', hr, 'bpm')}>Save</Button></>)}
        {kind === 'sleep' && (<><Stepper value={hours} step={0.25} min={1} max={16} unit="hours" onChange={setHours} /><Button busy={busy} onClick={() => void run(() => logSleep(profile, hours))}>Save</Button></>)}
        {err && <p role="alert" className="text-sm text-bad">{err}</p>}
      </div>
    </Sheet>
  )
}
