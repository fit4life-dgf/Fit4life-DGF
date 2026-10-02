import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, BookmarkPlus, Dumbbell, FolderOpen, Pencil, Plus, Trash2 } from 'lucide-react'
import type { Exercise } from '../../types'
import { useAuth } from '../../contexts/AuthContext'
import { useNav } from '../../contexts/NavContext'
import { useAsync } from '../../hooks/useAsync'
import { fetchProfileById } from '../../services/team'
import { createPlan } from '../../services/workouts'
import { deleteTemplate, fetchLibrary, fetchTemplates, saveTemplate, type TemplateEx } from '../../services/workoutSystem'
import { estimateMinutes } from '../../utils/workoutMath'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Sheet } from '../../components/ui/Sheet'
import { ChoiceRow } from '../../components/ui/NumberField'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorBox, LoadingBlocks, Notice } from '../../components/ui/StateViews'
import { MuscleSelector } from './MuscleSelector'
import { ExerciseLibrary, exercisesFor } from './ExerciseLibrary'
import { ExerciseDetail } from './ExerciseDetail'
import { ConfigureExercise } from './ConfigureExercise'
import { configLine, DEFAULT_CONFIG, DOW, ExThumb, uid, type ExerciseConfig } from './common'

interface DraftEx extends ExerciseConfig { key: string; exercise: Exercise }
interface DraftDay { key: string; name: string; dow: number; exercises: DraftEx[] }
interface Draft { name: string; days: DraftDay[] }

type Step = 'draft' | 'select' | 'library' | 'detail' | 'configure'

const newDay = (n: number, dow: number): DraftDay => ({ key: uid(), name: `Day ${n}`, dow, exercises: [] })
const blank = (): Draft => ({ name: 'Custom workout plan', days: [newDay(1, 1)] })
const storeKey = (clientId: string) => `f4l_draft_${clientId}`

function loadDraft(clientId: string): Draft {
  try {
    const raw = localStorage.getItem(storeKey(clientId))
    if (raw) {
      const d = JSON.parse(raw) as Draft
      if (d && typeof d.name === 'string' && Array.isArray(d.days) && d.days.length) return d
    }
  } catch { /* corrupt or unavailable: start fresh */ }
  return blank()
}

/** Trainer flow: 3D muscle selector -> exercises -> detail -> configure -> workout builder -> assign to the client. */
export function WorkoutBuilder() {
  const { profile } = useAuth()
  const nav = useNav()
  const clientId = nav.detail?.param ?? ''
  const person = useAsync(() => fetchProfileById(clientId), [clientId])
  const lib = useAsync(fetchLibrary, [])
  const tpl = useAsync(fetchTemplates, [])
  const [draft, setDraft] = useState<Draft>(() => loadDraft(clientId))
  const [dayIdx, setDayIdx] = useState(0)
  const [step, setStep] = useState<Step>('draft')
  const [muscle, setMuscle] = useState('chest')
  const [picked, setPicked] = useState<Exercise | null>(null)
  const [editKey, setEditKey] = useState<string | null>(null)
  const [sheet, setSheet] = useState<'templates' | 'save' | null>(null)
  const [tplName, setTplName] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ t: string; tone: 'good' | 'bad' } | null>(null)
  const [assigned, setAssigned] = useState(false)

  useEffect(() => {
    try { if (!assigned) localStorage.setItem(storeKey(clientId), JSON.stringify(draft)) } catch { /* draft just won't survive a reload */ }
  }, [draft, clientId, assigned])

  const library = lib.data ?? []
  const byId = useMemo(() => new Map(library.map((e) => [e.id, e])), [library])
  const day = draft.days[Math.min(dayIdx, draft.days.length - 1)]
  const clientName = person.data?.full_name ?? 'client'
  if (!profile) return null

  const patchDay = (fn: (d: DraftDay) => DraftDay) => setDraft((cur) => ({ ...cur, days: cur.days.map((d) => (d.key === day.key ? fn(d) : d)) }))
  const move = (i: number, dir: -1 | 1) => patchDay((d) => {
    const j = i + dir
    if (j < 0 || j >= d.exercises.length) return d
    const ex = [...d.exercises]; [ex[i], ex[j]] = [ex[j], ex[i]]
    return { ...d, exercises: ex }
  })
  const addDay = () => {
    if (draft.days.length >= 7) return
    setDraft((cur) => ({ ...cur, days: [...cur.days, newDay(cur.days.length + 1, Math.min(6, cur.days.length + 1))] }))
    setDayIdx(draft.days.length)
  }
  const removeDay = () => {
    if (draft.days.length <= 1) return
    setDraft((cur) => ({ ...cur, days: cur.days.filter((d) => d.key !== day.key) }))
    setDayIdx(0)
  }

  function saveConfig(cfg: ExerciseConfig) {
    if (editKey) patchDay((d) => ({ ...d, exercises: d.exercises.map((x) => (x.key === editKey ? { ...x, ...cfg } : x)) }))
    else if (picked) patchDay((d) => ({ ...d, exercises: [...d.exercises, { key: uid(), exercise: picked, ...cfg }] }))
    setEditKey(null); setPicked(null); setStep('draft')
  }

  async function assign() {
    setMsg(null)
    const name = draft.name.trim()
    if (!name) { setMsg({ t: 'Give the plan a name first.', tone: 'bad' }); return }
    const empty = draft.days.find((d) => d.exercises.length === 0)
    if (empty) { setMsg({ t: `${empty.name} has no exercises. Add some or remove the day.`, tone: 'bad' }); return }
    setBusy(true)
    try {
      await createPlan(profile!, clientId, name, draft.days.map((d) => ({
        name: d.name.trim() || 'Workout', focus: focusOf(d), day_of_week: d.dow,
        exercises: d.exercises.map((e) => ({ exercise_id: e.exercise.id, sets: e.sets, reps: String(e.reps), rest_sec: e.rest_sec, weight_kg: e.weight_kg > 0 ? e.weight_kg : null, tempo: e.tempo || null, rpe: e.rpe, rir: e.rir, notes: e.notes || null })),
      })))
      try { localStorage.removeItem(storeKey(clientId)) } catch { /* ignore */ }
      setAssigned(true)
    } catch (e) { setMsg({ t: e instanceof Error ? e.message : 'Could not assign the plan.', tone: 'bad' }) } finally { setBusy(false) }
  }

  async function saveAsTemplate() {
    setBusy(true); setMsg(null)
    try {
      const ex: TemplateEx[] = day.exercises.map((e) => ({ exercise_id: e.exercise.id, name: e.exercise.name, sets: e.sets, reps: e.reps, weight_kg: e.weight_kg, rest_sec: e.rest_sec, tempo: e.tempo, rpe: e.rpe, rir: e.rir, notes: e.notes }))
      await saveTemplate(profile!, tplName || day.name, '', ex)
      await tpl.reload()
      setSheet(null); setTplName('')
      setMsg({ t: 'Template saved.', tone: 'good' })
    } catch (e) { setMsg({ t: e instanceof Error ? e.message : 'Could not save the template.', tone: 'bad' }) } finally { setBusy(false) }
  }

  function loadTemplate(exs: TemplateEx[]) {
    const items: DraftEx[] = []
    let skipped = 0
    for (const t of exs) {
      const ex = byId.get(t.exercise_id)
      if (!ex) { skipped++; continue }
      items.push({ key: uid(), exercise: ex, sets: t.sets, reps: t.reps, weight_kg: t.weight_kg, rest_sec: t.rest_sec, tempo: t.tempo, rpe: t.rpe, rir: t.rir, notes: t.notes })
    }
    patchDay((d) => ({ ...d, exercises: [...d.exercises, ...items] }))
    setSheet(null)
    setMsg({ t: skipped ? `Template added. ${skipped} exercise(s) are no longer in the library and were skipped.` : 'Template added.', tone: 'good' })
  }

  if (!clientId) return <EmptyState icon={<Dumbbell />} title="No client selected" text="Open a client from the Team page, then choose Build workout." action={<Button onClick={() => nav.open('team')}>Go to team</Button>} />
  if (lib.loading) return <LoadingBlocks n={3} />
  if (lib.error) return <ErrorBox message={lib.error} onRetry={() => void lib.reload()} />

  if (assigned) {
    return (
      <Card className="grid gap-3 text-center">
        <h2 className="text-xl font-extrabold">Workout assigned</h2>
        <p className="text-sm text-ink2">{draft.name} is now {clientName}’s active plan. They have been notified and will see it under Today’s workout.</p>
        <Button onClick={() => nav.open('client', clientId)}>Back to client</Button>
      </Card>
    )
  }

  if (step === 'select') return <MuscleSelector title="Add exercise" hint="Pick the muscle you want to train, then choose an exercise." countFor={(m) => exercisesFor(library, m).length} onBack={() => setStep('draft')} onContinue={(m) => { setMuscle(m); setStep('library') }} />
  if (step === 'library') {
    return <ExerciseLibrary muscleId={muscle} library={library} addedIds={new Set(day.exercises.map((e) => e.exercise.id))} onBack={() => setStep('select')}
      onOpen={(e) => { setPicked(e); setStep('detail') }} onAdd={(e) => { setPicked(e); setEditKey(null); setStep('configure') }} />
  }
  if (step === 'detail' && picked) {
    return <ExerciseDetail exercise={picked} onBack={() => setStep('library')} actionLabel="Add to workout" onAction={() => { setEditKey(null); setStep('configure') }} />
  }
  if (step === 'configure') {
    const editing = editKey ? day.exercises.find((x) => x.key === editKey) : null
    const ex = editing?.exercise ?? picked
    if (ex) {
      return <ConfigureExercise exercise={ex} initial={editing ?? DEFAULT_CONFIG} prefill={!editing} saveLabel={editing ? 'Save changes' : 'Add to workout'}
        onBack={() => { const wasEdit = editKey != null; setEditKey(null); setStep(wasEdit ? 'draft' : picked ? 'library' : 'draft') }} onSave={saveConfig} />
    }
  }

  const mins = estimateMinutes(day.exercises.map((e) => ({ sets: e.sets, rest_sec: e.rest_sec })))
  return (
    <div className="grid gap-4">
      <PageHeader title="Workout builder" onBack={() => nav.open('client', clientId)} />
      <p className="-mt-2 text-sm text-ink2">For {clientName}. Your draft is saved on this device until you assign it.</p>
      {msg && <Notice text={msg.t} tone={msg.tone} />}
      <label className="grid gap-1 text-sm font-semibold">Plan name
        <input value={draft.name} maxLength={120} onChange={(e) => setDraft((cur) => ({ ...cur, name: e.target.value }))} className="min-h-[44px] rounded-tile border border-line bg-bg px-3 text-sm font-normal" />
      </label>
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Workout days">
        {draft.days.map((d, i) => (
          <button key={d.key} role="tab" aria-selected={d.key === day.key} onClick={() => setDayIdx(i)} className={`min-h-[40px] shrink-0 rounded-full px-4 text-sm font-semibold ${d.key === day.key ? 'bg-accent text-white' : 'bg-card2'}`}>{d.name || `Day ${i + 1}`}</button>
        ))}
        {draft.days.length < 7 && <button onClick={addDay} className="min-h-[40px] shrink-0 rounded-full border border-dashed border-line px-4 text-sm font-semibold text-ink2"><Plus size={14} className="mr-1 inline" />Add day</button>}
      </div>
      <Card className="grid gap-3">
        <label className="grid gap-1 text-sm font-semibold">Day name
          <input value={day.name} maxLength={60} onChange={(e) => patchDay((d) => ({ ...d, name: e.target.value }))} className="min-h-[44px] rounded-tile border border-line bg-bg px-3 text-sm font-normal" />
        </label>
        <ChoiceRow label="Day of week" value={String(day.dow)} options={DOW.map((n, i) => ({ id: String(i), label: n }))} onChange={(v) => patchDay((d) => ({ ...d, dow: Number(v) }))} />
        {draft.days.length > 1 && <Button variant="ghost" onClick={removeDay}><Trash2 size={16} />Remove this day</Button>}
      </Card>

      {!day.exercises.length ? <EmptyState icon={<Dumbbell />} title="No exercises yet" text="Choose a muscle on the 3D body to add your first exercise." /> : (
        <ul className="grid gap-2">
          {day.exercises.map((e, i) => (
            <li key={e.key} className="flex items-center gap-3 rounded-tile bg-card p-3 shadow-card">
              <ExThumb ex={e.exercise} size={48} />
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{i + 1}. {e.exercise.name}</p><p className="text-xs text-ink2">{configLine(e)}</p>{e.notes && <p className="truncate text-xs text-ink2">Note: {e.notes}</p>}</div>
              <div className="flex shrink-0 gap-1">
                <button aria-label={`Move ${e.exercise.name} up`} disabled={i === 0} onClick={() => move(i, -1)} className="flex h-9 w-9 items-center justify-center rounded-full bg-card2 disabled:opacity-40"><ArrowUp size={15} /></button>
                <button aria-label={`Move ${e.exercise.name} down`} disabled={i === day.exercises.length - 1} onClick={() => move(i, 1)} className="flex h-9 w-9 items-center justify-center rounded-full bg-card2 disabled:opacity-40"><ArrowDown size={15} /></button>
                <button aria-label={`Edit ${e.exercise.name}`} onClick={() => { setEditKey(e.key); setStep('configure') }} className="flex h-9 w-9 items-center justify-center rounded-full bg-card2"><Pencil size={15} /></button>
                <button aria-label={`Remove ${e.exercise.name}`} onClick={() => patchDay((d) => ({ ...d, exercises: d.exercises.filter((x) => x.key !== e.key) }))} className="flex h-9 w-9 items-center justify-center rounded-full bg-card2 text-bad"><Trash2 size={15} /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {day.exercises.length > 0 && <p className="text-xs text-ink2">About {mins} minutes · {day.exercises.reduce((a, e) => a + e.sets, 0)} sets</p>}
      <Button onClick={() => setStep('select')}><Plus size={16} />Add exercise</Button>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="soft" onClick={() => setSheet('templates')}><FolderOpen size={16} />Templates</Button>
        <Button variant="soft" disabled={!day.exercises.length} onClick={() => { setTplName(day.name); setSheet('save') }}><BookmarkPlus size={16} />Save as template</Button>
      </div>
      <Button busy={busy} onClick={() => void assign()}>Assign to {clientName}</Button>
      <p className="text-xs text-ink2">Assigning replaces {clientName}’s current plan.</p>

      <Sheet open={sheet === 'templates'} title="Workout templates" onClose={() => setSheet(null)}>
        {tpl.loading ? <p className="text-sm text-ink2">Loading…</p> : tpl.error ? <Notice tone="bad" text={tpl.error} /> : !(tpl.data ?? []).length ? <p className="text-sm text-ink2">No templates yet. Build a day and choose Save as template.</p> : (
          <ul className="grid max-h-[50vh] gap-2 overflow-y-auto">
            {(tpl.data ?? []).map((t) => (
              <li key={t.id} className="flex items-center gap-2 rounded-tile bg-card2 p-3">
                <button className="min-w-0 flex-1 text-left" onClick={() => loadTemplate(t.exercises)}><span className="block truncate text-sm font-bold">{t.name}</span><span className="block text-xs text-ink2">{t.exercises.length} exercises</span></button>
                <button aria-label={`Delete template ${t.name}`} onClick={() => { void deleteTemplate(t.id).then(() => tpl.reload()).catch((e: unknown) => setMsg({ t: e instanceof Error ? e.message : 'Could not delete.', tone: 'bad' })) }} className="flex h-9 w-9 items-center justify-center rounded-full bg-card text-bad"><Trash2 size={15} /></button>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
      <Sheet open={sheet === 'save'} title="Save as template" onClose={() => setSheet(null)}>
        <div className="grid gap-3">
          <label className="grid gap-1 text-sm font-semibold">Template name<input value={tplName} maxLength={120} onChange={(e) => setTplName(e.target.value)} className="min-h-[44px] rounded-tile border border-line bg-bg px-3 text-sm font-normal" /></label>
          <Button busy={busy} onClick={() => void saveAsTemplate()}>Save template</Button>
        </div>
      </Sheet>
    </div>
  )
}

function focusOf(d: DraftDay): string {
  const counts = new Map<string, number>()
  for (const e of d.exercises) counts.set(e.exercise.muscle, (counts.get(e.exercise.muscle) ?? 0) + 1)
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([m]) => m)
  return top.length ? top.join(' and ') : 'Workout'
}
