import { useState } from 'react'
import { Award, Clock, Dumbbell, Flame, Layers, Weight } from 'lucide-react'
import type { Profile } from '../../types'
import { askCoach } from '../../services/coach'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Notice } from '../../components/ui/StateViews'
import { MuscleBodyView } from '../../components/muscle3d/MuscleBodyView'
import { BODY_COLORS, muscleName } from '../../components/muscle3d/muscleMap'
import { recoveryHours, type Recovery } from '../../utils/workoutMath'
import { formatNumber } from '../../utils/format'
import { recoveryColors, STATUS_LABEL } from './recoveryColors'

export interface SummaryData {
  name: string
  minutes: number
  exercises: number
  sets: number
  volume: number
  calories: number
  prs: { name: string; weight: number; reps: number }[]
  loads: Record<string, number>
  recovery: Record<string, Recovery>
  queued: boolean
  tips: string[]
}

interface Props { data: SummaryData; profile: Profile; onDone: () => void; onRecovery: () => void }

/** Screen 8: duration, exercises, sets, volume, calories, records, muscles trained and the recovery update. */
export function WorkoutSummary({ data: d, profile, onDone, onRecovery }: Props) {
  const [ai, setAi] = useState<{ text: string; tone: 'info' | 'bad' } | null>(null)
  const [busy, setBusy] = useState(false)
  const trained = Object.entries(d.loads).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
  const only = new Set(trained.map(([id]) => id))

  async function ask() {
    setBusy(true); setAi(null)
    const q = `I just finished "${d.name}": ${d.minutes} min, ${d.sets} sets, ${formatNumber(d.volume)} kg total volume. Muscles worked most: ${trained.slice(0, 4).map(([id]) => muscleName(id)).join(', ') || 'n/a'}.${d.prs.length ? ` Personal records: ${d.prs.map((p) => p.name).join(', ')}.` : ''} Give me three short tips for recovery and my next session.`
    try { setAi({ text: await askCoach(profile, q), tone: 'info' }) } catch (e) { setAi({ text: e instanceof Error ? e.message : 'The coach is unavailable right now.', tone: 'bad' }) } finally { setBusy(false) }
  }

  const stat = (Icon: typeof Clock, label: string, value: string) => (
    <div className="rounded-tile bg-card2 p-3"><Icon size={16} className="text-ink2" aria-hidden /><p className="tabular mt-1 text-xl font-extrabold">{value}</p><p className="text-xs text-ink2">{label}</p></div>
  )

  return (
    <div className="grid gap-4 [&>*]:min-w-0">
      <div className="text-center"><h1 className="text-2xl font-extrabold">Workout complete</h1><p className="text-sm text-ink2">{d.name}</p></div>
      {d.queued && <Notice text="You are offline. This workout is saved on your phone and will upload automatically when you are back online." />}
      <div className="grid grid-cols-2 gap-3">
        {stat(Clock, 'Duration', `${d.minutes} min`)}
        {stat(Dumbbell, 'Exercises', String(d.exercises))}
        {stat(Layers, 'Sets', String(d.sets))}
        {stat(Weight, 'Volume', `${formatNumber(d.volume)} kg`)}
        {stat(Flame, 'Calories (estimate)', `${d.calories} kcal`)}
        {stat(Award, 'Personal records', String(d.prs.length))}
      </div>
      {d.prs.length > 0 && (
        <Card className="grid gap-1 bg-workout/30 border-0"><h2 className="text-sm font-bold">New personal records</h2>
          {d.prs.map((p) => <p key={p.name} className="text-sm">{p.name}: {p.weight > 0 ? `${p.weight} kg × ` : ''}{p.reps}</p>)}</Card>
      )}
      <Card className="grid gap-3">
        <h2 className="text-sm font-bold">Muscles trained</h2>
        {trained.length ? (
          <>
            <MuscleBodyView colors={recoveryColors(d.recovery, only)} height="h-[300px]" label="Muscles trained and recovery" />
            <ul className="grid gap-1.5 text-sm">
              {trained.map(([id, v]) => {
                const r = d.recovery[id]
                return (
                  <li key={id} className="flex items-center justify-between"><span className="flex items-center gap-2"><span aria-hidden className="h-3 w-3 rounded-full" style={{ background: r ? BODY_COLORS[r.status] : BODY_COLORS.idle }} />{muscleName(id)}</span>
                    <span className="text-xs text-ink2">{Math.round(v * 10) / 10} sets · {r ? `${STATUS_LABEL[r.status]}${r.hoursLeft ? `, about ${r.hoursLeft} h to go` : ''}` : ''}</span></li>
                )
              })}
            </ul>
            <p className="text-xs text-ink2">Recovery times are training-load estimates ({recoveryHours('chest', 0)}–{recoveryHours('chest', 20)} h for large muscles). They are a planning guide, not a medical measurement.</p>
          </>
        ) : <p className="text-sm text-ink2">No exercises were linked to muscles in this workout.</p>}
      </Card>
      {d.tips.length > 0 && <Card className="grid gap-1 text-sm"><h2 className="font-bold">Next time</h2>{d.tips.map((t) => <p key={t}>{t}</p>)}</Card>}
      <Card className="grid gap-2"><h2 className="text-sm font-bold">AI Coach</h2>
        {ai && <Notice text={ai.text} tone={ai.tone} />}
        <Button variant="soft" busy={busy} onClick={() => void ask()}>Ask the AI Coach about this workout</Button></Card>
      <div className="grid gap-2 sm:grid-cols-2"><Button variant="soft" onClick={onRecovery}>See full recovery map</Button><Button onClick={onDone}>Done</Button></div>
    </div>
  )
}
