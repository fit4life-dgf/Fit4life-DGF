import { useEffect, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, List, Plus, Undo2, X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Sheet } from '../../components/ui/Sheet'
import { NumberField, ChoiceRow } from '../../components/ui/NumberField'
import { Notice } from '../../components/ui/StateViews'
import { MuscleBodyView } from '../../components/muscle3d/MuscleBodyView'
import { muscleName } from '../../components/muscle3d/muscleMap'
import type { History } from '../../services/workoutSystem'
import { e1rm } from '../../utils/workoutMath'
import { mmss } from './common'
import { doneSets, nextExercise, pendingIndex, totalSets, type Active, type PSet } from './session'

interface Props {
  active: Active
  history: History
  onChange: (a: Active) => void
  onSetDone: (a: Active, exIdx: number) => void
  onFinish: () => void
  onExit: () => void
}

const RPE = [{ id: 'none', label: 'Skip' }, ...[6, 7, 8, 9, 10].map((n) => ({ id: String(n), label: String(n) }))]

/** Screen 6: one exercise at a time with last performance, weight / reps / RPE inputs and Complete set. */
export function LivePlayer({ active, history, onChange, onSetDone, onFinish, onExit }: Props) {
  const [now, setNow] = useState(Date.now())
  const [list, setList] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t) }, [toast])

  const elapsed = Math.floor((now - new Date(active.startedAt).getTime()) / 1000)
  const exIdx = Math.min(active.ex, active.items.length - 1)
  const it = active.items[exIdx]
  const si = pendingIndex(it)
  const prev = history.previous[it.exercise.id]
  const prim = it.exercise.primary_muscle ? [it.exercise.primary_muscle] : []

  const replaceItem = (fn: (s: PSet[]) => PSet[]): Active => ({ ...active, items: active.items.map((x, i) => (i === exIdx ? { ...x, sets: fn(x.sets) } : x)) })
  const patchSet = (idx: number, p: Partial<PSet>) => onChange(replaceItem((sets) => sets.map((s, j) => (j === idx ? { ...s, ...p } : s))))
  const go = (i: number) => onChange({ ...active, ex: Math.max(0, Math.min(active.items.length - 1, i)) })

  function complete() {
    if (si < 0) return
    const s = it.sets[si]
    const score = e1rm(s.weight, s.reps)
    const sessionBest = Math.max(0, ...it.sets.filter((x, j) => x.done && j !== si).map((x) => e1rm(x.weight, x.reps)))
    const base = history.baseline[it.exercise.id] ?? 0
    const pr = base > 0 && score > Math.max(base, sessionBest)
    if (pr) setToast(`New personal record on ${it.exercise.name}!`)
    const next = replaceItem((sets) => sets.map((x, j) => (j === si ? { ...x, done: true, doneAt: new Date().toISOString(), pr } : x)))
    onSetDone(next, exIdx)
  }

  const addSet = () => onChange(replaceItem((sets) => { const l = sets[sets.length - 1]; return [...sets, { reps: l?.reps ?? it.target, weight: l?.weight ?? 0, rpe: null, done: false, doneAt: null, pr: false }] }))
  const undo = () => {
    const last = [...it.sets].map((s, j) => ({ s, j })).reverse().find((x) => x.s.done)
    if (last) patchSet(last.j, { done: false, doneAt: null, pr: false })
  }
  const nextEx = nextExercise(active, exIdx + 1)
  const cur = si >= 0 ? it.sets[si] : null

  return (
    <div className="grid gap-4">
      <div className="sticky top-0 z-10 -mx-4 flex items-center gap-3 border-b border-line bg-bg/95 px-4 py-3 backdrop-blur">
        <button aria-label="Leave workout" onClick={() => { if (window.confirm('Leave this workout? Your progress stays saved on this device so you can resume it.')) onExit() }} className="flex h-10 w-10 items-center justify-center rounded-full bg-card2"><X size={18} /></button>
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{active.name}</p><p className="tabular text-xs text-ink2">{mmss(elapsed)} · {doneSets(active)}/{totalSets(active)} sets</p></div>
        <button aria-label="Exercise list" onClick={() => setList(true)} className="flex h-10 w-10 items-center justify-center rounded-full bg-card2"><List size={18} /></button>
        <Button onClick={onFinish}>Finish</Button>
      </div>
      {toast && <Notice text={toast} tone="good" />}

      <div className="flex items-center justify-between text-sm font-semibold text-ink2">
        <button aria-label="Previous exercise" disabled={exIdx === 0} onClick={() => go(exIdx - 1)} className="flex h-10 w-10 items-center justify-center rounded-full bg-card2 disabled:opacity-40"><ChevronLeft size={18} /></button>
        <span>Exercise {exIdx + 1} of {active.items.length}</span>
        <button aria-label="Next exercise" disabled={exIdx === active.items.length - 1} onClick={() => go(exIdx + 1)} className="flex h-10 w-10 items-center justify-center rounded-full bg-card2 disabled:opacity-40"><ChevronRight size={18} /></button>
      </div>

      {it.exercise.video_url
        ? <video src={it.exercise.video_url} playsInline loop muted autoPlay className="w-full rounded-card bg-card2" aria-label={`${it.exercise.name} demonstration`} />
        : <MuscleBodyView selected={prim} secondary={it.exercise.secondary ?? []} pulse={prim} height="h-[210px]" controls={false} autoFace label={`Muscles worked by ${it.exercise.name}`} />}

      <div>
        <h1 className="text-2xl font-extrabold">{it.exercise.name}</h1>
        <p className="text-sm text-ink2">{prim.map(muscleName).join(', ') || it.exercise.muscle} · {it.exercise.equipment}</p>
        {(it.exercise.cue || it.tempo || it.notes) && (
          <p className="mt-1 text-xs text-ink2">{[it.exercise.cue, it.tempo ? `Tempo ${it.tempo}` : null, it.notes ? `Coach: ${it.notes}` : null].filter(Boolean).join(' · ')}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2" aria-label="Sets">
        {it.sets.map((s, j) => (
          <span key={j} className={`flex h-9 min-w-[2.25rem] items-center justify-center rounded-full px-3 text-xs font-bold ${s.done ? 'bg-good text-white' : j === si ? 'border-2 border-accent bg-card' : 'bg-card2 text-ink2'}`}>
            {s.done ? <Check size={14} aria-label={`Set ${j + 1} done`} /> : j + 1}{s.pr ? ' PR' : ''}
          </span>
        ))}
      </div>

      {prev ? (
        <Card className="text-sm"><p className="text-xs font-semibold text-ink2">Last time · {new Date(prev.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
          <p className="tabular font-semibold">{prev.sets.map((s) => `${s.weight_kg > 0 ? `${s.weight_kg} kg × ` : ''}${s.reps}`).join('   ·   ')}</p></Card>
      ) : <p className="text-xs text-ink2">No previous record for this exercise yet.</p>}

      {cur ? (
        <div className="grid gap-3">
          <p className="text-sm font-bold">Set {si + 1} of {it.sets.length} <span className="font-normal text-ink2">· target {it.target} reps{it.targetRpe ? ` at RPE ${it.targetRpe}` : ''}</span></p>
          <NumberField label="Weight" value={cur.weight} step={2.5} min={0} max={500} unit="kg" onChange={(n) => patchSet(si, { weight: n })} />
          <NumberField label="Reps" value={cur.reps} step={1} min={0} max={100} onChange={(n) => patchSet(si, { reps: n })} />
          <ChoiceRow label="RPE (how hard it felt, 10 is maximal)" value={cur.rpe == null ? 'none' : String(cur.rpe)} options={RPE} onChange={(v) => patchSet(si, { rpe: v === 'none' ? null : Number(v) })} />
          <Button onClick={complete}><Check size={18} />Complete set</Button>
        </div>
      ) : (
        <Card className="grid gap-2 text-center"><p className="font-bold">Exercise complete</p>
          {nextEx >= 0 ? <Button onClick={() => go(nextEx)}>Next exercise</Button> : <Button onClick={onFinish}>Finish workout</Button>}</Card>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="soft" onClick={addSet}><Plus size={16} />Add set</Button>
        <Button variant="soft" disabled={!it.sets.some((s) => s.done)} onClick={undo}><Undo2 size={16} />Undo last set</Button>
      </div>

      <Sheet open={list} title="Workout" onClose={() => setList(false)}>
        <ul className="grid max-h-[55vh] gap-2 overflow-y-auto">
          {active.items.map((x, i) => {
            const d = x.sets.filter((s) => s.done).length
            return (
              <li key={x.key}><button onClick={() => { go(i); setList(false) }} className={`flex w-full items-center justify-between rounded-tile p-3 text-left ${i === exIdx ? 'bg-accent/15' : 'bg-card2'}`}>
                <span className="text-sm font-bold">{i + 1}. {x.exercise.name}</span><span className="tabular text-xs text-ink2">{d}/{x.sets.length}</span></button></li>
            )
          })}
        </ul>
      </Sheet>
    </div>
  )
}
