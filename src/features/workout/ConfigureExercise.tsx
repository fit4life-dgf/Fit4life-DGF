import { useState } from 'react'
import type { Exercise } from '../../types'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { NumberField, ChoiceRow } from '../../components/ui/NumberField'
import { Notice } from '../../components/ui/StateViews'
import { ExThumb, type ExerciseConfig } from './common'

interface Props { exercise: Exercise; initial: ExerciseConfig; saveLabel: string; onSave: (c: ExerciseConfig) => void; onBack: () => void }

const TEMPO = /^[0-9X]-[0-9X]-[0-9X]-[0-9X]$/i
const RPE = [{ id: 'none', label: 'Not set' }, ...[6, 7, 8, 9, 10].map((n) => ({ id: String(n), label: String(n) }))]
const RIR = [{ id: 'none', label: 'Not set' }, ...[0, 1, 2, 3, 4].map((n) => ({ id: String(n), label: String(n) }))]

/** Screen 4: sets, reps, weight, rest, tempo, RPE, RIR and notes for one exercise. */
export function ConfigureExercise({ exercise, initial, saveLabel, onSave, onBack }: Props) {
  const [c, setC] = useState<ExerciseConfig>(initial)
  const set = <K extends keyof ExerciseConfig>(k: K, v: ExerciseConfig[K]) => setC((cur) => ({ ...cur, [k]: v }))
  const tempoBad = c.tempo.trim() !== '' && !TEMPO.test(c.tempo.trim())
  return (
    <div className="grid gap-4">
      <PageHeader title="Configure exercise" onBack={onBack} />
      <div className="flex items-center gap-3 rounded-tile bg-card p-3 shadow-card"><ExThumb ex={exercise} /><div><p className="font-bold">{exercise.name}</p><p className="text-xs text-ink2">{exercise.equipment} · {exercise.level}</p></div></div>
      <NumberField label="Sets" value={c.sets} step={1} min={1} max={10} onChange={(n) => set('sets', n)} />
      <NumberField label="Reps" value={c.reps} step={1} min={1} max={100} onChange={(n) => set('reps', n)} />
      <NumberField label="Weight" value={c.weight_kg} step={2.5} min={0} max={500} unit="kg" onChange={(n) => set('weight_kg', n)} />
      <NumberField label="Rest" value={c.rest_sec} step={15} min={0} max={600} unit="s" onChange={(n) => set('rest_sec', n)} />
      <label className="grid gap-1 text-sm font-semibold">Tempo (down-pause-up-pause, e.g. 3-1-1-0)
        <input value={c.tempo} maxLength={7} inputMode="text" onChange={(e) => set('tempo', e.target.value)} aria-invalid={tempoBad}
          className="min-h-[44px] rounded-tile border border-line bg-bg px-3 text-sm font-normal" placeholder="Optional" />
      </label>
      {tempoBad && <Notice tone="bad" text="Use four characters separated by dashes, like 3-1-1-0 (X means as fast as possible)." />}
      <ChoiceRow label="Target RPE (effort, 10 is maximal)" value={c.rpe == null ? 'none' : String(c.rpe)} options={RPE} onChange={(v) => set('rpe', v === 'none' ? null : Number(v))} />
      <ChoiceRow label="Reps in reserve (RIR)" value={c.rir == null ? 'none' : String(c.rir)} options={RIR} onChange={(v) => set('rir', v === 'none' ? null : Number(v))} />
      <label className="grid gap-1 text-sm font-semibold">Trainer notes
        <textarea value={c.notes} maxLength={400} rows={3} onChange={(e) => set('notes', e.target.value)} className="rounded-tile border border-line bg-bg p-3 text-sm font-normal" placeholder="Cues or limits for this client" />
      </label>
      <Button disabled={tempoBad} onClick={() => onSave({ ...c, tempo: c.tempo.trim(), notes: c.notes.trim() })}>{saveLabel}</Button>
    </div>
  )
}
