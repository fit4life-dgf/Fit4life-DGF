import { useState } from 'react'
import { Activity, Bike, Dumbbell, Footprints, Play, Zap } from 'lucide-react'
import type { Profile, SessionRow, WorkoutSeed } from '../../types'
import { useNav } from '../../contexts/NavContext'
import { fetchPlanDays, fetchSessions } from '../../services/workouts'
import { fetchMemberDetails } from '../../services/nutrition'
import { pendingCount } from '../../services/workoutSystem'
import { useAsync } from '../../hooks/useAsync'
import { Card } from '../ui/Card'
import { EmptyState } from '../ui/EmptyState'
import { ErrorBox, LoadingBlocks, Notice } from '../ui/StateViews'
import { WorkoutPlayer } from './WorkoutPlayer'
import { TINT } from '../ui/colors'

const QUICK = [
  { label: 'Run', category: 'Running', Icon: Footprints },
  { label: 'Spinning', category: 'Spinning', Icon: Bike },
  { label: 'HIIT', category: 'HIIT', Icon: Zap },
  { label: 'Yoga', category: 'Yoga', Icon: Activity },
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
  const nav = useNav()
  const plan = useAsync(() => fetchPlanDays(profile.id), [profile.id])
  const sessions = useAsync(() => fetchSessions(profile.id, 30), [profile.id])
  const details = useAsync(() => fetchMemberDetails(profile.id), [profile.id])
  const [seed, setSeed] = useState<WorkoutSeed | null>(null)
  const today = new Date().getDay()
  const pending = pendingCount(profile.id)

  // Timed sessions (run, spinning, HIIT, yoga) use the simple timer player; strength workouts use the full set-by-set player.
  if (seed) {
    return <WorkoutPlayer seed={seed} profile={profile} weightKg={details.data?.weight_kg ?? null}
      onExit={() => { setSeed(null); void sessions.reload() }} />
  }

  const startFree = (category: string, label: string) => setSeed({ name: label, category, dayId: null, exercises: [] })
  const strip = weekStrip(sessions.data ?? [])
  const todayDay = plan.data?.days.find((d) => d.day_of_week === today)

  return (
    <div className="grid gap-5">
      {pending > 0 && <Notice text={`${pending} workout${pending === 1 ? '' : 's'} saved on this device will upload when you are back online.`} />}
      <section aria-label="Today's workout" className="grid gap-3">
        <h2 className="text-base font-bold">Today’s workout</h2>
        {plan.loading ? <LoadingBlocks n={1} h="h-32" /> : plan.error ? <ErrorBox message={plan.error} onRetry={() => void plan.reload()} /> : todayDay ? (
          <Card className={`${TINT.workout} border-0`}>
            <p className="text-xs font-semibold text-ink/70">{plan.data?.planName} · {DAY_NAMES[todayDay.day_of_week]}</p>
            <h3 className="text-lg font-extrabold text-ink">{todayDay.name}</h3>
            <p className="text-sm text-ink/70">{todayDay.focus} · {todayDay.exercises.length} exercises{todayDay.est_minutes ? ` · about ${todayDay.est_minutes} min` : ''}</p>
            <button onClick={() => nav.open('workoutday', todayDay.id)} className="mt-3 flex min-h-[44px] items-center gap-2 rounded-tile bg-ink px-5 text-sm font-semibold text-bg"><Play size={16} />Open workout</button>
          </Card>
        ) : <p className="rounded-tile bg-card2 p-4 text-sm text-ink2">{plan.data?.days.length ? 'Nothing is scheduled for today. Pick a day from your plan below.' : 'No plan yet. Your trainer will assign one, or you can explore exercises below.'}</p>}
      </section>

      <section aria-label="Explore" className="grid grid-cols-2 gap-3">
        <button onClick={() => nav.open('muscles')} className="rounded-card border border-line bg-card p-4 text-left shadow-card"><Dumbbell size={20} className="mb-2 text-accent" aria-hidden /><span className="block text-sm font-bold">Explore muscles</span><span className="block text-xs text-ink2">Tap the 3D body to find exercises</span></button>
        <button onClick={() => nav.open('recovery')} className="rounded-card border border-line bg-card p-4 text-left shadow-card"><Activity size={20} className="mb-2 text-accent" aria-hidden /><span className="block text-sm font-bold">Recovery map</span><span className="block text-xs text-ink2">See which muscles are ready</span></button>
      </section>

      <section aria-label="Your plan" className="grid gap-3">
        <h2 className="text-base font-bold">Your plan{plan.data ? ` · ${plan.data.planName}` : ''}</h2>
        {plan.loading ? <LoadingBlocks n={1} /> : plan.error ? null :
          !plan.data || !plan.data.days.length ? <EmptyState icon={<Dumbbell />} title="No plan yet" text="Your trainer will assign a plan. You can still start a timed workout below or explore exercises." /> :
            <ul className="grid gap-2">{plan.data.days.map((d) => (
              <li key={d.id}><button onClick={() => nav.open('workoutday', d.id)} className="flex w-full items-center justify-between rounded-tile bg-card p-3 text-left shadow-card">
                <span><span className="block text-sm font-bold">{DAY_NAMES[d.day_of_week]} · {d.name}</span><span className="block text-xs text-ink2">{d.focus} · {d.exercises.length} exercises</span></span><Play size={16} className="text-ink2" /></button></li>))}</ul>}
      </section>

      <section aria-label="Start a timed workout" className="grid gap-3">
        <h2 className="text-base font-bold">Start a timed workout</h2>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {QUICK.map(({ label, category, Icon }) => (
            <button key={label} onClick={() => startFree(category, label)} className="flex min-h-[44px] shrink-0 items-center gap-2 rounded-full bg-workout/40 px-4 text-sm font-semibold"><Icon size={16} />{label}</button>
          ))}
        </div>
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
    </div>
  )
}
