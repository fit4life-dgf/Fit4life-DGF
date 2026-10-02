import { useState } from 'react'
import { useAsync } from '../../hooks/useAsync'
import { useAuth } from '../../contexts/AuthContext'
import { readGoal, writeGoal } from './goalPref'
import { GoalDefaultsEditor } from './GoalDefaultsEditor'
import { fetchGoalPrescriptions, fetchTrainingGoals } from '../../services/workoutSystem'
import { formatRange, formatRest, goalDefaultLayer, NOT_PRESCRIBED, resolvePrescription, SOURCE_LABEL, type Layer } from '../../utils/prescription'
import type { Exercise } from '../../types'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { PageHeader } from '../../components/ui/PageHeader'
import { MuscleBodyView } from '../../components/muscle3d/MuscleBodyView'
import { BODY_COLORS, muscleName, roleColors } from '../../components/muscle3d/muscleMap'

interface Props {
  exercise: Exercise; onBack: () => void; actionLabel?: string; onAction?: () => void
  /** Values the trainer set for this client, and values a program specifies. Both win over the goal default. */
  assignment?: Layer | null
  program?: Layer | null
}



type Tab = 'overview' | 'instructions' | 'mistakes' | 'breathing' | 'tips'
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' }, { id: 'instructions', label: 'Instructions' }, { id: 'mistakes', label: 'Common mistakes' },
  { id: 'breathing', label: 'Breathing' }, { id: 'tips', label: 'Training tips' },
]

const LEGEND: { key: 'primary' | 'secondary' | 'stabilizer' | 'inactive'; label: string }[] = [
  { key: 'primary', label: 'Primary' }, { key: 'secondary', label: 'Secondary' }, { key: 'stabilizer', label: 'Stabilizer' }, { key: 'inactive', label: 'Not involved' },
]

function Empty({ what }: { what: string }) { return <p className="text-sm text-ink2">{what} has not been added for this exercise yet.</p> }

function RoleList({ title, ids, color }: { title: string; ids: string[]; color: string }) {
  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-wide text-ink2">{title}</h3>
      {ids.length ? (
        <ul className="mt-1 grid gap-1">{ids.map((id) => <li key={id} className="flex items-center gap-2 text-sm"><span aria-hidden className="h-3 w-3 rounded-full" style={{ background: color }} />{muscleName(id)}</li>)}</ul>
      ) : <p className="mt-1 text-sm text-ink2">None listed</p>}
    </div>
  )
}

/** Screen 3: what the exercise is, how to do it, and which muscles it works by role (primary, secondary, stabilizer). */
export function ExerciseDetail({ exercise: e, onBack, actionLabel, onAction, assignment = null, program = null }: Props) {
  const [tab, setTab] = useState<Tab>('overview')
  const [goal, setGoalState] = useState(readGoal)
  const setGoal = (g: string) => { setGoalState(g); writeGoal(g) }
  const { profile } = useAuth()
  const isStaff = profile != null && profile.role !== 'member'
  const [editing, setEditing] = useState(false)
  const goals = useAsync(() => fetchTrainingGoals(), [])
  const rows = useAsync(() => fetchGoalPrescriptions(e.id), [e.id])
  const goalName = (goals.data ?? []).find((g) => g.id === goal)?.name ?? goal
  const rx = resolvePrescription({ assignment, program, goalDefault: goalDefaultLayer(rows.data, goal) })
  const fields: [string, string, string][] = [
    ['Sets', formatRange(rx.sets.value), SOURCE_LABEL[rx.sets.source]], ['Reps', formatRange(rx.reps.value), SOURCE_LABEL[rx.reps.source]],
    ['Rest', formatRest(rx.restSeconds.value), SOURCE_LABEL[rx.restSeconds.source]], ['Tempo', rx.tempo.value ?? NOT_PRESCRIBED, SOURCE_LABEL[rx.tempo.source]],
  ]
  const prim = e.primary_muscle ? [e.primary_muscle] : []
  const sec = e.secondary ?? []
  const stab = e.stabilizers ?? []
  const compound = e.is_compound ?? sec.length >= 2
  const steps = e.instructions ?? []
  const mistakes = e.common_mistakes ?? []
  const tips = e.tips ?? []

  return (
    <div className="grid gap-4">
      <PageHeader title={e.name} onBack={onBack} />
      <div className="grid min-w-0 gap-4 lg:grid-cols-2 lg:items-start">
        <div className="grid min-w-0 gap-3 lg:sticky lg:top-4">
          {e.video_url ? (
            <video src={e.video_url} controls playsInline loop muted className="w-full rounded-card bg-card2" aria-label={`${e.name} demonstration`} />
          ) : (
            <MuscleBodyView colors={roleColors(prim, sec, stab)} pulse={prim} height="h-[320px]" controls autoFace viewModes animation
              modelUrl={e.animation_url ?? null} clip={e.animation_clip ?? null} label={`Muscles worked by ${e.name}`} />
          )}
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Colour key">
            {LEGEND.map((l) => <li key={l.key} className="flex items-center gap-1.5"><span aria-hidden className="h-3 w-3 rounded-full" style={{ background: BODY_COLORS[l.key] }} />{l.label}</li>)}
          </ul>
          <p className="text-xs text-ink2">Muscle roles are a training guide, not a medical or electrical measurement.</p>
        </div>

        <div className="grid min-w-0 gap-4">
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-card2 px-3 py-1.5">{e.muscle}</span>
            <span className="rounded-full bg-card2 px-3 py-1.5">{compound ? 'Compound' : 'Isolation'}</span>
            <span className="rounded-full bg-card2 px-3 py-1.5 capitalize">{e.level}</span>
            <span className="rounded-full bg-card2 px-3 py-1.5">{e.equipment}</span>
          </div>

          <Card className="grid gap-3">
            <h2 className="font-bold">Muscles involved</h2>
            <RoleList title="Primary" ids={prim} color={BODY_COLORS.primary} />
            <RoleList title="Secondary" ids={sec} color={BODY_COLORS.secondary} />
            <RoleList title="Stabilizers" ids={stab} color={BODY_COLORS.stabilizer} />
          </Card>

          <div role="tablist" aria-label="Exercise information" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
            {TABS.map((t) => (
              <button key={t.id} role="tab" type="button" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
                className={`min-h-[40px] shrink-0 rounded-full px-3.5 text-sm font-semibold ${tab === t.id ? 'bg-accent text-white' : 'bg-card2 text-ink2'}`}>{t.label}</button>
            ))}
          </div>

          <Card role="tabpanel" className="grid gap-3">
            {tab === 'overview' && (
              <>
                <label className="flex items-center gap-2 text-sm font-semibold">Goal
                  <select value={goal} onChange={(ev) => setGoal(ev.target.value)} aria-label="Training goal" className="min-h-[40px] min-w-0 flex-1 rounded-full bg-card2 px-3 text-sm">
                    {(goals.data ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </label>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {fields.map(([k, v, src]) => (
                    <div key={k} className="min-w-0 rounded-card bg-card2 px-1 py-2"><div className="text-[11px] text-ink2">{k}</div><div className="text-sm font-bold">{v}</div><div className="text-[10px] text-ink2">{src}</div></div>
                  ))}
                </div>
                {isStaff && <Button variant="soft" onClick={() => setEditing(true)}>Edit {goalName} default</Button>}
                {editing && <GoalDefaultsEditor key={goal} open exerciseId={e.id} exerciseName={e.name} goalId={goal} goalName={goalName} current={(rows.data ?? []).find((r) => r.goal_id === goal) ?? null}
                  onClose={() => setEditing(false)} onSaved={() => void rows.reload()} />}
                <p className="text-xs text-ink2">Goal defaults are general guideline ranges, not a personal plan. Your trainer's values replace them.</p>
                <p className="text-sm"><span className="font-semibold">Equipment: </span>{e.equipment}</p>
                {e.cue && <p className="rounded-card bg-workout/30 p-3 text-sm"><span className="font-bold">Coaching cue: </span>{e.cue}</p>}
              </>
            )}
            {tab === 'instructions' && (steps.length ? (
              <ol className="grid gap-2 text-sm">{steps.map((s, i) => <li key={i} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">{i + 1}</span><span>{s}</span></li>)}</ol>
            ) : <Empty what="Step-by-step guidance" />)}
            {tab === 'mistakes' && (mistakes.length ? <ul className="grid list-disc gap-2 pl-5 text-sm">{mistakes.map((s, i) => <li key={i}>{s}</li>)}</ul> : <Empty what="Common mistakes guidance" />)}
            {tab === 'breathing' && (e.breathing ? <p className="text-sm">{e.breathing}</p> : <Empty what="Breathing guidance" />)}
            {tab === 'tips' && (tips.length ? <ul className="grid list-disc gap-2 pl-5 text-sm">{tips.map((s, i) => <li key={i}>{s}</li>)}</ul> : <Empty what="Training tips" />)}
          </Card>

          {onAction && actionLabel && <Button onClick={onAction}>{actionLabel}</Button>}
        </div>
      </div>
    </div>
  )
}
