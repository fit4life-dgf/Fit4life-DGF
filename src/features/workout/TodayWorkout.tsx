import { Play, RotateCcw } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { PageHeader } from '../../components/ui/PageHeader'
import { MuscleBodyView } from '../../components/muscle3d/MuscleBodyView'
import { muscleName } from '../../components/muscle3d/muscleMap'
import { estimateMinutes } from '../../utils/workoutMath'
import { ExThumb, configLine, DOW } from './common'
import { doneSets, totalSets, type Active, type DayLike } from './session'

interface Props { day: DayLike; planName: string | null; dow?: number; resume: Active | null; busy: boolean; onStart: () => void; onResume: () => void; onDiscard: () => void; onBack: () => void }

/** Screen 5: the workout assigned for the day: sequence, time estimate, and Start. */
export function TodayWorkout({ day, planName, dow, resume, busy, onStart, onResume, onDiscard, onBack }: Props) {
  const mins = day.est_minutes ?? estimateMinutes(day.exercises.map((e) => ({ sets: e.sets, rest_sec: e.rest_sec })))
  const sets = day.exercises.reduce((a, e) => a + e.sets, 0)
  const prim = Array.from(new Set(day.exercises.map((e) => e.exercise.primary_muscle).filter((m): m is string => !!m)))
  return (
    <div className="grid gap-4">
      <PageHeader title="Today’s workout" onBack={onBack} />
      <Card className="bg-workout/40 border-0">
        <p className="text-xs font-semibold text-ink/70">{planName ?? 'Quick workout'}{dow != null ? ` · ${DOW[dow]}` : ''}</p>
        <h2 className="text-2xl font-extrabold text-ink">{day.name}</h2>
        <p className="text-sm text-ink/70">{day.focus}</p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div><p className="tabular text-xl font-extrabold text-ink">{day.exercises.length}</p><p className="text-[11px] text-ink/70">exercises</p></div>
          <div><p className="tabular text-xl font-extrabold text-ink">{sets}</p><p className="text-[11px] text-ink/70">sets</p></div>
          <div><p className="tabular text-xl font-extrabold text-ink">~{mins}</p><p className="text-[11px] text-ink/70">minutes</p></div>
        </div>
      </Card>
      {prim.length > 0 && (
        <div className="grid gap-2">
          <MuscleBodyView selected={prim} height="h-[240px]" controls={false} autoFace label="Muscles in today’s workout" />
          <p className="text-xs text-ink2">Today trains: {prim.map(muscleName).join(', ')}.</p>
        </div>
      )}
      <ol className="grid gap-2">
        {day.exercises.map((e, i) => (
          <li key={e.id} className="flex items-center gap-3 rounded-tile bg-card p-3 shadow-card">
            <ExThumb ex={e.exercise} size={48} />
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{i + 1}. {e.exercise.name}</p><p className="text-xs text-ink2">{configLine({ sets: e.sets, reps: Number(/\d+/.exec(e.reps)?.[0] ?? 10), weight_kg: e.weight_kg ?? 0, rest_sec: e.rest_sec })}</p>{e.notes && <p className="text-xs text-ink2">Coach: {e.notes}</p>}</div>
          </li>
        ))}
      </ol>
      {resume ? (
        <Card className="grid gap-2">
          <p className="text-sm font-bold">You have a workout in progress</p>
          <p className="text-xs text-ink2">{doneSets(resume)} of {totalSets(resume)} sets logged.</p>
          <Button onClick={onResume}><Play size={16} />Resume workout</Button>
          <Button variant="ghost" onClick={() => { if (window.confirm('Discard the workout in progress?')) onDiscard() }}><RotateCcw size={16} />Start over</Button>
        </Card>
      ) : (
        <Button busy={busy} disabled={!day.exercises.length} onClick={onStart}><Play size={16} />Start workout</Button>
      )}
    </div>
  )
}
