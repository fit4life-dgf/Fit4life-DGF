import { useCallback, useMemo, useState } from 'react'
import { Dumbbell } from 'lucide-react'
import type { Profile } from '../../types'
import { useAuth } from '../../contexts/AuthContext'
import { useNav } from '../../contexts/NavContext'
import { useAsync } from '../../hooks/useAsync'
import { fetchPlanDays } from '../../services/workouts'
import { fetchMemberDetails } from '../../services/nutrition'
import { fetchHistory, fetchLibrary, fetchSetRows, muscleMapOf, saveSession, type History } from '../../services/workoutSystem'
import { MUSCLE_IDS } from '../../components/muscle3d/muscleMap'
import { muscleLoad, recoveryMap, suggestNext, toEvents } from '../../utils/workoutMath'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorBox, LoadingBlocks, Notice } from '../../components/ui/StateViews'
import { TodayWorkout } from './TodayWorkout'
import { LivePlayer } from './LivePlayer'
import { RestTimer } from './RestTimer'
import { WorkoutSummary, type SummaryData } from './WorkoutSummary'
import {
  buildActive, doneSets, loadActive, nextExercise, pendingIndex, saveActive, singleExerciseDay, toPlayed, totalSets,
  type Active, type DayLike,
} from './session'

type Phase = 'today' | 'play' | 'rest' | 'saving' | 'summary'
const EMPTY: History = { previous: {}, baseline: {} }

export function WorkoutDayFlow() {
  const { profile } = useAuth()
  if (!profile) return null
  return <Flow profile={profile} />
}

/** Client flow: Today's workout -> player -> rest timer -> summary. The param is a plan day id, or "ex:<exerciseId>" for one exercise from the library. */
function Flow({ profile }: { profile: Profile }) {
  const nav = useNav()
  const param = nav.detail?.param ?? ''
  const single = param.startsWith('ex:')
  const plan = useAsync(() => fetchPlanDays(profile.id), [profile.id])
  const lib = useAsync(fetchLibrary, [])
  const details = useAsync(() => fetchMemberDetails(profile.id), [profile.id])
  const [phase, setPhase] = useState<Phase>('today')
  const [saved, setSaved] = useState<Active | null>(() => loadActive(profile.id))
  const [active, setActive] = useState<Active | null>(null)
  const [history, setHistory] = useState<History>(EMPTY)
  const [rest, setRest] = useState<{ seconds: number; nextEx: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [summary, setSummary] = useState<SummaryData | null>(null)

  const planDay = plan.data?.days.find((d) => d.id === param)
  const day: DayLike | null = useMemo(() => {
    if (single) { const e = lib.data?.find((x) => x.id === param.slice(3)); return e ? singleExerciseDay(e) : null }
    return planDay ? { id: planDay.id, name: planDay.name, focus: planDay.focus, est_minutes: planDay.est_minutes, exercises: planDay.exercises } : null
  }, [single, param, lib.data, planDay])

  const persist = useCallback((a: Active | null) => { setActive(a); saveActive(profile.id, a) }, [profile.id])
  const resumable = saved && day && (saved.dayId === day.id && (day.id != null || saved.name === day.name)) ? saved : null

  const endRest = useCallback(() => {
    if (rest && active) persist({ ...active, ex: rest.nextEx })
    setRest(null)
    setPhase('play')
  }, [rest, active, persist])

  async function loadHistory(d: DayLike): Promise<History> {
    try { return await fetchHistory(profile.id, d.exercises.map((e) => e.exercise.id)) } catch { return EMPTY }
  }

  async function start() {
    if (!day) return
    setBusy(true); setErr(null)
    const h = await loadHistory(day)
    setHistory(h)
    persist(buildActive(day, h))
    setBusy(false); setPhase('play')
  }
  async function resume() {
    if (!day || !resumable) return
    setBusy(true)
    setHistory(await loadHistory(day))
    persist(resumable)
    setBusy(false); setPhase('play')
  }
  const discard = () => { saveActive(profile.id, null); setSaved(null); setActive(null) }

  function onSetDone(a: Active, exIdx: number) {
    persist(a)
    const nx = nextExercise(a, exIdx)
    if (nx < 0) return // every set is done: the player now offers Finish
    const seconds = a.items[exIdx].rest
    if (seconds <= 0) { persist({ ...a, ex: nx }); return }
    setRest({ seconds, nextEx: nx })
    setPhase('rest')
  }

  async function finish() {
    const a = active
    if (!a) return
    if (doneSets(a) === 0) { setErr('Log at least one set before finishing.'); return }
    if (doneSets(a) < totalSets(a) && !window.confirm('Some sets are not done yet. Finish anyway?')) return
    setErr(null); setPhase('saving')
    const endedAt = new Date().toISOString()
    const played = toPlayed(a, history.baseline)
    try {
      const res = await saveSession(profile, { clientKey: a.clientKey, name: a.name, dayId: a.dayId, startedAt: a.startedAt, endedAt, sets: played, weightKg: details.data?.weight_kg ?? null })
      persist(null); setSaved(null)
      const library = lib.data ?? (await fetchLibrary().catch(() => []))
      const map = muscleMapOf(library)
      const loads = muscleLoad(played.map((p) => ({ exerciseId: p.exercise_id })), map)
      let events = [{ at: new Date(endedAt), loads }]
      try {
        const rows = (await fetchSetRows(profile.id, 14)).filter((r) => !res.id || r.session_id !== res.id)
        events = [...toEvents(rows, map), ...events]
      } catch { /* recovery falls back to this session alone */ }
      const tips: string[] = []
      for (const it of a.items) {
        const done = it.sets.filter((s) => s.done && s.weight > 0)
        const hint = done.length ? suggestNext(done.map((s) => ({ reps: s.reps, weight_kg: s.weight, rpe: s.rpe })), it.target) : null
        if (hint) tips.push(`${it.exercise.name}: ${hint.note}`)
      }
      setSummary({
        name: a.name, minutes: res.minutes, exercises: new Set(played.map((p) => p.exercise_id ?? p.exercise_name)).size, sets: played.length,
        volume: res.volume, calories: res.calories,
        prs: played.filter((p) => p.is_pr).map((p) => ({ name: p.exercise_name, weight: p.weight_kg, reps: p.reps })),
        loads, recovery: recoveryMap(events, MUSCLE_IDS), queued: res.queued, tips: tips.slice(0, 3),
      })
      setPhase('summary')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save the workout. Your progress is still on this device.')
      setPhase('play')
    }
  }

  const loading = plan.loading || (single && lib.loading)
  if (phase === 'summary' && summary) return <WorkoutSummary data={summary} profile={profile} onDone={() => nav.back()} onRecovery={() => nav.open('recovery')} />
  if (loading) return <LoadingBlocks n={3} />
  if (plan.error || (single && lib.error)) return <ErrorBox message={plan.error ?? lib.error ?? 'Could not load the workout.'} onRetry={() => { void plan.reload(); void lib.reload() }} />
  if (!day) return <EmptyState icon={<Dumbbell />} title="Workout not found" text="This workout is no longer in your plan. Ask your trainer if it was replaced." action={<Button onClick={() => nav.back()}>Go back</Button>} />

  if (phase === 'saving') return <Card className="text-center"><p className="font-bold">Saving your workout…</p><LoadingBlocks n={1} h="h-16" /></Card>
  if (phase === 'rest' && rest && active) {
    const it = active.items[rest.nextEx]
    const idx = Math.max(0, pendingIndex(it))
    const s = it.sets[idx]
    return <RestTimer seconds={rest.seconds} next={`${it.exercise.name} · set ${idx + 1} of ${it.sets.length}`} detail={s ? `${s.weight > 0 ? `${s.weight} kg × ` : ''}${s.reps} reps` : ''} onDone={endRest} />
  }
  if (phase === 'play' && active) {
    return (
      <div className="grid gap-3">
        {err && <Notice text={err} tone="bad" />}
        <LivePlayer active={active} history={history} onChange={persist} onSetDone={onSetDone} onFinish={() => void finish()}
          onExit={() => { setSaved(active); setPhase('today') }} />
      </div>
    )
  }
  return (
    <div className="grid gap-3">
      {err && <Notice text={err} tone="bad" />}
      <TodayWorkout day={day} planName={single ? null : plan.data?.planName ?? null} dow={planDay?.day_of_week} resume={resumable} busy={busy}
        onStart={() => void start()} onResume={() => void resume()} onDiscard={discard} onBack={() => nav.back()} />
    </div>
  )
}
