import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Plus, Timer, X } from 'lucide-react'
import type { Exercise, Profile, SetLogInput, WorkoutSeed } from '../../types'
import { fetchExercises, lastWeights, saveWorkout } from '../../services/workouts'
import { useAsync } from '../../hooks/useAsync'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Sheet } from '../ui/Sheet'
import { NumberField } from '../ui/NumberField'
import { Notice } from '../ui/StateViews'

interface SetState { reps: number; weight: number; done: boolean }
interface ExState { key: string; exercise: Exercise; rest: number; sets: SetState[] }

const firstNumber = (s: string): number => { const m = /\d+/.exec(s); return m ? Number(m[0]) : 10 }
const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`

interface Props { seed: WorkoutSeed; profile: Profile; weightKg: number | null; onExit: () => void }

export function WorkoutPlayer({ seed, profile, weightKg, onExit }: Props) {
  const startedAt = useRef(new Date())
  const [now, setNow] = useState(Date.now())
  const [rest, setRest] = useState(0)
  const [items, setItems] = useState<ExState[]>([])
  const [picker, setPicker] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState<{ minutes: number; calories: number } | null>(null)
  const isStrength = seed.exercises.length > 0 || seed.category === 'Strength'

  useEffect(() => {
    const t = setInterval(() => { setNow(Date.now()); setRest((r) => (r > 0 ? r - 1 : 0)) }, 1000)
    return () => clearInterval(t)
  }, [])

  const names = useMemo(() => seed.exercises.map((e) => e.exercise.name), [seed])
  useEffect(() => {
    let alive = true
    void lastWeights(profile.id, names).catch(() => ({} as Record<string, number>)).then((w) => {
      if (!alive) return
      setItems(seed.exercises.map((e, i) => ({
        key: `${e.exercise.id}-${i}`, exercise: e.exercise, rest: e.rest_sec,
        sets: Array.from({ length: e.sets }, () => ({ reps: firstNumber(e.reps), weight: w[e.exercise.name] ?? 0, done: false })),
      })))
    })
    return () => { alive = false }
  }, [seed, names, profile.id])

  const elapsed = Math.floor((now - startedAt.current.getTime()) / 1000)

  const patch = (ei: number, si: number, p: Partial<SetState>) =>
    setItems((cur) => cur.map((it, i) => (i !== ei ? it : { ...it, sets: it.sets.map((s, j) => (j === si ? { ...s, ...p } : s)) })))

  function toggle(ei: number, si: number) {
    const s = items[ei].sets[si]
    patch(ei, si, { done: !s.done })
    if (!s.done) setRest(items[ei].rest)
  }
  const addSet = (ei: number) => setItems((cur) => cur.map((it, i) => {
    if (i !== ei) return it
    const last = it.sets[it.sets.length - 1] ?? { reps: 10, weight: 0, done: false }
    return { ...it, sets: [...it.sets, { reps: last.reps, weight: last.weight, done: false }] }
  }))
  const addExercise = (ex: Exercise) => {
    setItems((cur) => [...cur, { key: `${ex.id}-${cur.length}`, exercise: ex, rest: 60, sets: [{ reps: 10, weight: 0, done: false }] }])
    setPicker(false)
  }

  async function finish() {
    setBusy(true); setErr(null)
    const sets: SetLogInput[] = []
    items.forEach((it) => it.sets.forEach((s, j) => { if (s.done) sets.push({ exercise_id: it.exercise.id, exercise_name: it.exercise.name, set_no: j + 1, reps: s.reps, weight_kg: s.weight || null }) }))
    try {
      const r = await saveWorkout(profile, { name: seed.name, category: seed.category, dayId: seed.dayId, startedAt: startedAt.current, sets, weightKg })
      setDone({ minutes: r.minutes, calories: r.calories })
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not save workout.') } finally { setBusy(false) }
  }

  if (done) {
    return (
      <Card className="grid gap-3 text-center">
        <h2 className="text-xl font-extrabold">Workout saved</h2>
        <p className="text-sm text-ink2">{seed.name}</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-tile bg-card2 p-3"><p className="tabular text-2xl font-extrabold">{done.minutes}</p><p className="text-xs text-ink2">minutes</p></div>
          <div className="rounded-tile bg-card2 p-3"><p className="tabular text-2xl font-extrabold">{done.calories}</p><p className="text-xs text-ink2">kcal (estimate)</p></div>
        </div>
        <Button onClick={onExit}>Done</Button>
      </Card>
    )
  }

  return (
    <div className="grid gap-4">
      <div className="sticky top-0 z-10 -mx-4 flex items-center gap-3 border-b border-line bg-bg/95 px-4 py-3 backdrop-blur">
        <button aria-label="Discard workout" onClick={() => { if (window.confirm('Discard this workout?')) onExit() }} className="flex h-10 w-10 items-center justify-center rounded-full bg-card2"><X size={18} /></button>
        <div className="flex-1"><p className="text-sm font-bold">{seed.name}</p><p className="tabular text-xs text-ink2">{mmss(elapsed)} elapsed</p></div>
        {rest > 0 && <span className="tabular flex items-center gap-1 rounded-full bg-workout px-3 py-1 text-sm font-bold text-ink"><Timer size={14} />Rest {mmss(rest)}</span>}
        <Button busy={busy} onClick={() => void finish()}>Finish</Button>
      </div>
      {err && <Notice text={err} tone="bad" />}
      {!isStrength && <Card className="text-center"><p className="text-sm text-ink2">Timing your {seed.category.toLowerCase()} session. Tap Finish when you are done.</p><p className="tabular mt-2 text-5xl font-extrabold">{mmss(elapsed)}</p></Card>}
      {items.map((it, ei) => (
        <Card key={it.key} className="grid gap-3">
          <div><h3 className="font-bold">{it.exercise.name}</h3><p className="text-xs text-ink2">{it.exercise.muscle} · {it.exercise.equipment}{it.exercise.cue ? ` · ${it.exercise.cue}` : ''}</p></div>
          {it.sets.map((s, si) => (
            <div key={si} className={`grid gap-2 rounded-tile p-2 ${s.done ? 'bg-recovery/40' : 'bg-card2'}`}>
              <div className="flex items-center justify-between"><span className="text-xs font-bold text-ink2">SET {si + 1}</span>
                <button aria-pressed={s.done} aria-label={`Mark set ${si + 1} done`} onClick={() => toggle(ei, si)} className={`flex h-10 w-10 items-center justify-center rounded-full ${s.done ? 'bg-good text-white' : 'bg-card text-ink2'}`}><Check size={18} /></button></div>
              <NumberField label="Reps" value={s.reps} step={1} min={0} max={100} onChange={(n) => patch(ei, si, { reps: n })} />
              <NumberField label="Weight" value={s.weight} step={2.5} min={0} max={500} unit="kg" onChange={(n) => patch(ei, si, { weight: n })} />
            </div>
          ))}
          <Button variant="soft" onClick={() => addSet(ei)}><Plus size={16} />Add set</Button>
        </Card>
      ))}
      {isStrength && <Button variant="soft" onClick={() => setPicker(true)}><Plus size={16} />Add exercise</Button>}
      <ExercisePicker open={picker} onClose={() => setPicker(false)} onPick={addExercise} />
    </div>
  )
}

export function ExercisePicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (e: Exercise) => void }) {
  const { data, loading, error } = useAsync(fetchExercises, [])
  const [muscle, setMuscle] = useState('All')
  const muscles = useMemo(() => ['All', ...Array.from(new Set((data ?? []).map((e) => e.muscle)))], [data])
  const list = (data ?? []).filter((e) => muscle === 'All' || e.muscle === muscle)
  return (
    <Sheet open={open} title="Add exercise" onClose={onClose}>
      {error && <Notice text={error} tone="bad" />}
      {loading ? <p className="text-sm text-ink2">Loading…</p> : (
        <>
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">{muscles.map((m) => <button key={m} onClick={() => setMuscle(m)} className={`min-h-[40px] shrink-0 rounded-full px-3 text-sm font-semibold ${muscle === m ? 'bg-accent text-white' : 'bg-card2'}`}>{m}</button>)}</div>
          <ul className="grid max-h-[50vh] gap-2 overflow-y-auto">
            {list.map((e) => <li key={e.id}><button onClick={() => onPick(e)} className="w-full rounded-tile bg-card2 px-3 py-3 text-left"><p className="text-sm font-bold">{e.name}</p><p className="text-xs text-ink2">{e.muscle} · {e.equipment}</p></button></li>)}
            {!list.length && <li className="text-sm text-ink2">No exercises yet.</li>}
          </ul>
        </>
      )}
    </Sheet>
  )
}
