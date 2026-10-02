import { useState } from 'react'
import { Sheet } from '../../components/ui/Sheet'
import { Button } from '../../components/ui/Button'
import { NumberField } from '../../components/ui/NumberField'
import { Notice } from '../../components/ui/StateViews'
import { deleteGoalPrescription, saveGoalPrescription } from '../../services/workoutSystem'
import { validateGoalDefault, type GoalDefaultInput, type GoalPrescriptionRow } from '../../utils/prescription'

interface Props { open: boolean; exerciseId: string; exerciseName: string; goalId: string; goalName: string; current: GoalPrescriptionRow | null; onClose: () => void; onSaved: () => void }

/** Staff edit the recommended range for one exercise and one training goal. Clients never see this form. */
export function GoalDefaultsEditor({ open, exerciseId, exerciseName, goalId, goalName, current, onClose, onSaved }: Props) {
  const [v, setV] = useState<GoalDefaultInput>(() => ({
    sets_min: current?.sets_min ?? 3, sets_max: current?.sets_max ?? 4, reps_min: current?.reps_min ?? 8, reps_max: current?.reps_max ?? 12,
    rest_min_seconds: current?.rest_min_seconds ?? 60, rest_max_seconds: current?.rest_max_seconds ?? 90, tempo: current?.tempo ?? '',
  }))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const set = <K extends keyof GoalDefaultInput>(k: K, n: GoalDefaultInput[K]) => setV((c) => ({ ...c, [k]: n }))
  const problem = validateGoalDefault(v)

  async function run(fn: () => Promise<void>) {
    setBusy(true); setErr(null)
    try { await fn(); onSaved(); onClose() } catch (e) { setErr(e instanceof Error ? e.message : 'Could not save') } finally { setBusy(false) }
  }

  return (
    <Sheet open={open} title={`${goalName} default`} onClose={onClose}>
      <div className="grid max-h-[70vh] gap-3 overflow-y-auto">
        <p className="text-sm text-ink2">Recommended range for <span className="font-semibold">{exerciseName}</span> when the goal is {goalName}. A trainer's values for a client always replace this.</p>
        <NumberField label="Sets min" value={v.sets_min} step={1} min={1} max={10} onChange={(n) => set('sets_min', n)} />
        <NumberField label="Sets max" value={v.sets_max} step={1} min={1} max={10} onChange={(n) => set('sets_max', n)} />
        <NumberField label="Reps min" value={v.reps_min} step={1} min={1} max={100} onChange={(n) => set('reps_min', n)} />
        <NumberField label="Reps max" value={v.reps_max} step={1} min={1} max={100} onChange={(n) => set('reps_max', n)} />
        <NumberField label="Rest min" value={v.rest_min_seconds} step={15} min={0} max={600} unit="s" onChange={(n) => set('rest_min_seconds', n)} />
        <NumberField label="Rest max" value={v.rest_max_seconds} step={15} min={0} max={600} unit="s" onChange={(n) => set('rest_max_seconds', n)} />
        <label className="grid gap-1 text-sm font-semibold">Tempo (optional, like 3-1-1-0)
          <input value={v.tempo} maxLength={7} onChange={(e) => set('tempo', e.target.value)} className="min-h-[44px] rounded-tile border border-line bg-bg px-3 text-sm font-normal" placeholder="Not prescribed" />
        </label>
        {(problem || err) && <Notice tone="bad" text={problem ?? err ?? ''} />}
        <Button busy={busy} disabled={problem != null} onClick={() => void run(() => saveGoalPrescription(exerciseId, goalId, v))}>Save default</Button>
        {current && <Button variant="ghost" disabled={busy} onClick={() => void run(() => deleteGoalPrescription(exerciseId, goalId))}>Remove this default</Button>}
      </div>
    </Sheet>
  )
}
