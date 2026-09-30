import { useMemo, useState } from 'react'
import { Bike, Dumbbell, Footprints, Play, Zap } from 'lucide-react'
import type { Exercise, PlanDay, Profile, SessionRow, WorkoutSeed } from '../../types'
import { fetchExercises, fetchPlanDays, fetchSessions } from '../../services/workouts'
import { fetchMemberDetails } from '../../services/nutrition'
import { useAsync } from '../../hooks/useAsync'
import { Card } from '../ui/Card'
import { Sheet } from '../ui/Sheet'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { ErrorBox, LoadingBlocks } from '../ui/StateViews'
import { WorkoutPlayer } from './WorkoutPlayer'
import { TINT } from '../ui/colors'

const QUICK = [
  { label: 'Run', category: 'Running', Icon: Footprints },
  { label: 'Spinning', category: 'Spinning', Icon: Bike },
  { label: 'Strength training', category: 'Strength', Icon: Dumbbell },
  { label: 'HIIT', category: 'HIIT', Icon: Zap },
]
const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function weekStrip(sessions: SessionRow[]): boolean[] {
  const out: boolean[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    out.push(sessions.some((s) => new Date(s.started_at).toDateString() === d.toDateString()))
  }
  return out
}

export function WorkoutsView({ profile }: { profile: Profile }) {
  const plan = useAsync(() => fetchPlanDays(profile.id), [profile.id])
  const sessions = useAsync(() => fetchSessions(profile.id, 30), [profile.id])
  const lib = useAsync(fetchExercises, [])
  const details = useAsync(() => fetchMemberDetails(profile.id), [profile.id])
  const [seed, setSeed] = useState<WorkoutSeed | null>(null)
  const [open, setOpen] = useState<Exercise | null>(null)
  const [muscle, setMuscle] = useState('All')

  const muscles = useMemo(() => ['All', ...Array.from(new Set((lib.data ?? []).map((e) => e.muscle)))], [lib.data])
  const shown = (lib.data ?? []).filter((e) => muscle === 'All' || e.muscle === muscle)
  const today = new Date().getDay()

  if (seed) {
    return <WorkoutPlayer seed={seed} profile={profile} weightKg={details.data?.weight_kg ?? null}
      onExit={() => { setSeed(null); void sessions.reload() }} />
  }

  const startDay = (d: PlanDay) => setSeed({
    name: d.name, category: 'Strength', dayId: d.id,
    exercises: d.exercises.map((e) => ({ exercise: e.exercise, sets: e.sets, reps: e.reps, rest_sec: e.rest_sec })),
  })
  const startFree = (category: string, label: string) => setSeed({ name: label, category, dayId: null, exercises: [] })

  const strip = weekStrip(sessions.data ?? [])
  const todayDay = plan.data?.days.find((d) => d.day_of_week === today)

  return (
    <div className="grid gap-5">
      <section aria-label="Start a workout" className="grid gap-3">
        <h2 className="text-base font-bold">Start a workout</h2>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {QUICK.map(({ label, category, Icon }) => (
            <button key={label} onClick={() => startFree(category, label)} className="flex min-h-[44px] shrink-0 items-center gap-2 rounded-full bg-workout/40 px-4 text-sm font-semibold"><Icon size={16} />{label}</button>
          ))}
        </div>
        {todayDay && (
          <Card className={`${TINT.workout} border-0`}>
            <p className="text-xs font-semibold text-ink/70">Today in your plan</p>
            <h3 className="text-lg font-extrabold text-ink">{todayDay.name}</h3>
            <p className="text-sm text-ink/70">{todayDay.focus} · {todayDay.exercises.length} exercises</p>
            <button onClick={() => startDay(todayDay)} className="mt-3 flex min-h-[44px] items-center gap-2 rounded-tile bg-ink px-5 text-sm font-semibold text-bg"><Play size={16} />Start</button>
          </Card>
        )}
      </section>

      <section aria-label="Your plan" className="grid gap-3">
        <h2 className="text-base font-bold">Your plan{plan.data ? ` · ${plan.data.planName}` : ''}</h2>
        {plan.loading ? <LoadingBlocks n={1} /> : plan.error ? <ErrorBox message={plan.error} onRetry={() => void plan.reload()} /> :
          !plan.data || !plan.data.days.length ? <EmptyState icon={<Dumbbell />} title="No plan yet" text="Your trainer will assign a plan. You can still start any workout above." /> :
            <ul className="grid gap-2">{plan.data.days.map((d) => (
              <li key={d.id}><button onClick={() => startDay(d)} className="flex w-full items-center justify-between rounded-tile bg-card p-3 text-left shadow-card">
                <span><span className="block text-sm font-bold">{DAY_NAMES[d.day_of_week]} · {d.name}</span><span className="block text-xs text-ink2">{d.focus} · {d.exercises.length} exercises</span></span><Play size={16} className="text-ink2" /></button></li>))}</ul>}
      </section>

      <section aria-label="Recent activities" className="grid gap-3">
        <h2 className="text-base font-bold">Recent activities</h2>
        <Card className="flex justify-between">{strip.map((on, i) => {
          const d = new Date(); d.setDate(d.getDate() - (6 - i))
          return <div key={i} className="flex flex-col items-center gap-1"><span className={`h-8 w-8 rounded-full ${on ? 'bg-good' : 'bg-card2'}`} aria-label={on ? 'Workout done' : 'No workout'} /><span className="text-[11px] font-semibold text-ink2">{DAYS[d.getDay()]}</span></div>
        })}</Card>
        {sessions.loading ? <LoadingBlocks n={1} h="h-20" /> : sessions.error ? <ErrorBox message={sessions.error} onRetry={() => void sessions.reload()} /> :
          !(sessions.data ?? []).length ? <p className="text-sm text-ink2">No workouts logged in the last 30 days.</p> :
            <ul className="grid gap-2">{(sessions.data ?? []).slice(0, 8).map((s) => (
              <li key={s.id} className="flex items-center justify-between rounded-tile bg-card p-3 shadow-card"><span><span className="block text-sm font-bold">{s.name}</span><span className="block text-xs text-ink2">{new Date(s.started_at).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} · {s.duration_min ?? 0} min</span></span><span className="tabular text-sm font-bold">{s.calories ?? 0}<small className="ml-0.5 text-xs font-medium text-ink2">kcal</small></span></li>))}</ul>}
      </section>

      <section aria-label="Exercise library" className="grid gap-3">
        <h2 className="text-base font-bold">Exercise library</h2>
        <div className="flex gap-2 overflow-x-auto pb-1">{muscles.map((m) => <button key={m} onClick={() => setMuscle(m)} className={`min-h-[40px] shrink-0 rounded-full px-3 text-sm font-semibold ${muscle === m ? 'bg-accent text-white' : 'bg-card2'}`}>{m}</button>)}</div>
        {lib.loading ? <LoadingBlocks n={2} h="h-16" /> : lib.error ? <ErrorBox message={lib.error} onRetry={() => void lib.reload()} /> :
          <ul className="grid gap-2 sm:grid-cols-2">{shown.map((e) => (
            <li key={e.id}><button onClick={() => setOpen(e)} className="w-full rounded-tile bg-card p-3 text-left shadow-card"><span className="block text-sm font-bold">{e.name}</span><span className="block text-xs text-ink2">{e.muscle} · {e.equipment} · {e.level}</span></button></li>))}</ul>}
      </section>

      <Sheet open={open != null} title={open?.name ?? ''} onClose={() => setOpen(null)}>
        {open && <div className="grid gap-3"><p className="text-sm text-ink2">{open.muscle} · {open.equipment} · {open.level}</p><p className="text-sm">{open.cue ?? 'No coaching cue yet.'}</p>
          <Button onClick={() => { const e = open; setOpen(null); setSeed({ name: e.name, category: 'Strength', dayId: null, exercises: [{ exercise: e, sets: 3, reps: '10', rest_sec: 60 }] }) }}>Start with this exercise</Button></div>}
      </Sheet>
    </div>
  )
}
