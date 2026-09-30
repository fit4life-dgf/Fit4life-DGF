import { useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNav } from '../contexts/NavContext'
import { fetchProfileById } from '../services/team'
import { fetchToday } from '../services/health'
import { fetchSessions, fetchExercises, createPlan } from '../services/workouts'
import { assignDietPlan, fetchDietPlan, fetchMemberDetails } from '../services/nutrition'
import { fetchMeasurements } from '../services/progress'
import { fetchAttendance, fetchMembership, daysLeft } from '../services/gym'
import { useAsync } from '../hooks/useAsync'
import { computeScore } from '../utils/score'
import { buildPlan, PLAN_TEMPLATES } from '../utils/planTemplates'
import { dailyTargets } from '../utils/energy'
import { formatDuration, formatNumber } from '../utils/format'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Sheet } from '../components/ui/Sheet'
import { NumberField } from '../components/ui/NumberField'
import { ErrorBox, LoadingBlocks, Notice } from '../components/ui/StateViews'

export function ClientPage() {
  const { profile } = useAuth()
  const nav = useNav()
  const id = nav.detail?.param ?? ''
  const person = useAsync(() => fetchProfileById(id), [id])
  const today = useAsync(() => fetchToday(id), [id])
  const sessions = useAsync(() => fetchSessions(id, 14), [id])
  const meas = useAsync(() => fetchMeasurements(id), [id])
  const mem = useAsync(() => fetchMembership(id), [id])
  const att = useAsync(() => fetchAttendance(id, 30), [id])
  const diet = useAsync(() => fetchDietPlan(id), [id])
  const details = useAsync(() => fetchMemberDetails(id), [id])
  const [sheet, setSheet] = useState<'plan' | 'diet' | null>(null)
  const [msg, setMsg] = useState<{ t: string; tone: 'good' | 'bad' } | null>(null)
  const [busy, setBusy] = useState(false)
  const suggested = useMemo(() => dailyTargets(details.data ?? null), [details.data])
  const [cal, setCal] = useState(2000)
  const [pro, setPro] = useState(120)
  const [carb, setCarb] = useState(220)
  const [fat, setFat] = useState(60)
  const [title, setTitle] = useState('Diet plan')
  const [notes, setNotes] = useState('')
  if (!profile) return null

  const score = today.data ? computeScore(today.data, today.data.goals) : null
  const lastW = [...(meas.data ?? [])].reverse().find((m) => m.weight_kg != null)?.weight_kg
  const left = daysLeft(mem.data ?? null)
  const err = person.error ?? today.error

  async function applyTemplate(tid: string) {
    const t = PLAN_TEMPLATES.find((x) => x.id === tid)
    if (!t) return
    setBusy(true); setMsg(null)
    try {
      const lib = await fetchExercises()
      const { days, missing } = buildPlan(t, lib)
      if (!days.some((d) => d.exercises.length)) throw new Error('The exercise library is missing the exercises this template needs.')
      await createPlan(profile!, id, `${t.label}`, days)
      setSheet(null)
      setMsg({ t: missing.length ? `Plan assigned. Skipped missing exercises: ${missing.join(', ')}.` : 'Plan assigned and the member was notified.', tone: 'good' })
    } catch (e) { setMsg({ t: e instanceof Error ? e.message : 'Could not assign plan.', tone: 'bad' }) } finally { setBusy(false) }
  }
  async function saveDiet() {
    setBusy(true); setMsg(null)
    try {
      await assignDietPlan(profile!, id, { title: title.trim() || 'Diet plan', notes: notes.trim(), calories: cal, protein_g: pro, carbs_g: carb, fat_g: fat })
      setSheet(null); await diet.reload(); setMsg({ t: 'Diet plan assigned and the member was notified.', tone: 'good' })
    } catch (e) { setMsg({ t: e instanceof Error ? e.message : 'Could not save diet plan.', tone: 'bad' }) } finally { setBusy(false) }
  }

  return (
    <div className="grid gap-4">
      <PageHeader title={person.data?.full_name ?? 'Client'} onBack={() => nav.open('team')} />
      {err && <ErrorBox message={err} onRetry={() => { void person.reload(); void today.reload() }} />}
      {msg && <Notice text={msg.t} tone={msg.tone} />}
      {today.loading ? <LoadingBlocks n={2} h="h-28" /> : today.data && score && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-recovery/50 border-0"><p className="text-xs font-semibold text-ink/70">Daily score</p><p className="tabular text-3xl font-extrabold text-ink">{score.daily ?? '—'}</p><p className="text-xs text-ink/70">{score.label ?? 'No data today'}</p></Card>
            <Card className="bg-steps/50 border-0"><p className="text-xs font-semibold text-ink/70">Steps today</p><p className="tabular text-3xl font-extrabold text-ink">{formatNumber(today.data.steps)}</p></Card>
            <Card className="bg-sleep/60 border-0"><p className="text-xs font-semibold text-ink/70">Last sleep</p><p className="tabular text-2xl font-extrabold text-ink">{today.data.sleep ? formatDuration(today.data.sleep.duration_min) : '—'}</p></Card>
            <Card className="bg-card2 border-0"><p className="text-xs font-semibold text-ink2">Weight</p><p className="tabular text-2xl font-extrabold">{lastW ?? '—'}<small className="text-xs font-medium"> kg</small></p></Card>
          </div>
          <Card className="grid gap-1 text-sm"><h2 className="font-bold">Membership and attendance</h2><p>{mem.data ? (left != null && left >= 0 ? `Active, ${left} days left` : 'Expired') : 'No membership on record'}</p><p className="text-ink2">Visits in last 30 days: {att.data?.length ?? 0}</p></Card>
          <Card className="grid gap-1 text-sm"><h2 className="font-bold">Workouts, last 14 days</h2>{(sessions.data ?? []).length ? (sessions.data ?? []).slice(0, 6).map((s) => <p key={s.id} className="flex justify-between"><span>{s.name}</span><span className="text-ink2">{s.duration_min ?? 0} min</span></p>) : <p className="text-ink2">No workouts logged.</p>}</Card>
          {diet.data && <Card className="text-sm"><h2 className="font-bold">Current diet plan</h2><p>{diet.data.title}: {diet.data.calories ?? '—'} kcal, {diet.data.protein_g ?? '—'}g protein</p></Card>}
        </>
      )}
      <div className="grid gap-2 sm:grid-cols-3">
        <Button onClick={() => nav.open('chat', id)}>Message</Button>
        <Button variant="soft" onClick={() => setSheet('plan')}>Assign workout plan</Button>
        <Button variant="soft" onClick={() => { if (suggested) { setCal(suggested.calories); setPro(suggested.protein_g); setCarb(suggested.carbs_g); setFat(suggested.fat_g) } setSheet('diet') }}>Assign diet plan</Button>
      </div>

      <Sheet open={sheet === 'plan'} title="Assign workout plan" onClose={() => setSheet(null)}>
        <div className="grid gap-2"><p className="text-sm text-ink2">Replaces the current plan. The member is notified.</p>
          {PLAN_TEMPLATES.map((t) => <button key={t.id} disabled={busy} onClick={() => void applyTemplate(t.id)} className="rounded-tile bg-card2 p-3 text-left"><span className="block text-sm font-bold">{t.label}</span><span className="block text-xs text-ink2">{t.description}</span></button>)}</div>
      </Sheet>
      <Sheet open={sheet === 'diet'} title="Assign diet plan" onClose={() => setSheet(null)}>
        <div className="grid gap-3">
          {suggested ? <p className="text-xs text-ink2">Pre-filled from the member’s body details. Adjust as needed.</p> : <p className="text-xs text-ink2">The member has not added body details, so no suggestion is available.</p>}
          <label className="grid gap-1 text-sm font-semibold">Title<input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} className="min-h-[44px] rounded-tile border border-line bg-bg px-3 text-sm font-normal" /></label>
          <NumberField label="Calories" value={cal} step={50} min={1000} max={5000} unit="kcal" onChange={setCal} />
          <NumberField label="Protein" value={pro} step={5} min={30} max={300} unit="g" onChange={setPro} />
          <NumberField label="Carbs" value={carb} step={10} min={0} max={600} unit="g" onChange={setCarb} />
          <NumberField label="Fat" value={fat} step={5} min={0} max={200} unit="g" onChange={setFat} />
          <label className="grid gap-1 text-sm font-semibold">Notes<textarea value={notes} maxLength={1500} rows={4} onChange={(e) => setNotes(e.target.value)} className="rounded-tile border border-line bg-bg p-3 text-sm font-normal" /></label>
          <Button busy={busy} onClick={() => void saveDiet()}>Save diet plan</Button>
        </div>
      </Sheet>
    </div>
  )
}
