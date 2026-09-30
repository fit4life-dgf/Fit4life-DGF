import { useState } from 'react'
import { Moon } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useNav } from '../contexts/NavContext'
import { fetchRecentSleep, logSleepDetailed, type SleepEntry, DEFAULT_GOALS } from '../services/health'
import { fetchSessions } from '../services/workouts'
import { useAsync } from '../hooks/useAsync'
import { sleepScoreOf, restingHrScore, labelFor } from '../utils/score'
import { formatDuration } from '../utils/format'
import { localISODate } from '../utils/dates'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Sheet } from '../components/ui/Sheet'
import { Stepper } from '../components/ui/Stepper'
import { ChoiceRow } from '../components/ui/NumberField'
import { DailyBars } from '../components/progress/Charts'
import { ErrorBox, LoadingBlocks, Notice } from '../components/ui/StateViews'
import { EmptyState } from '../components/ui/EmptyState'

export function SleepPage() {
  const { profile } = useAuth()
  const nav = useNav()
  const sleep = useAsync(() => fetchRecentSleep(profile!.id, 7), [profile?.id])
  const load = useAsync(() => fetchSessions(profile!.id, 3), [profile?.id])
  const [open, setOpen] = useState(false)
  const [hours, setHours] = useState(7.5)
  const [rested, setRested] = useState<SleepEntry['rested']>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  if (!profile) return null

  const rows = sleep.data ?? []
  const last = rows[rows.length - 1] ?? null
  const goal = DEFAULT_GOALS.sleep_min
  const avg = rows.length ? Math.round(rows.reduce((s, r) => s + r.duration_min, 0) / rows.length) : null
  const score = sleepScoreOf(last, goal)
  const rhr = restingHrScore(last?.resting_hr ?? null)
  const recovery = score == null ? null : Math.round(rhr == null ? score : score * 0.6 + rhr * 0.4)
  const trainMin = (load.data ?? []).reduce((s, x) => s + (x.duration_min ?? 0), 0)
  const advice = recovery == null ? 'Log last night’s sleep to see your recovery.'
    : recovery >= 80 ? 'Well recovered. A hard session is fine today.'
    : recovery >= 60 ? 'Moderately recovered. Train, but keep a rep or two in reserve.'
    : 'Low recovery. Choose light movement, stretching and an early night.'
  const bars = rows.map((r) => ({ date: r.sleep_date, value: Math.round((r.duration_min / 60) * 10) / 10 }))

  async function save() {
    setBusy(true); setErr(null)
    try { await logSleepDetailed(profile!, { hours, rested }, localISODate()); setOpen(false); await sleep.reload() } catch (e) { setErr(e instanceof Error ? e.message : 'Could not save.') } finally { setBusy(false) }
  }

  return (
    <div className="grid gap-4">
      <PageHeader title="Sleep & recovery" onBack={nav.back} />
      {sleep.loading ? <LoadingBlocks n={3} h="h-32" /> : sleep.error ? <ErrorBox message={sleep.error} onRetry={() => void sleep.reload()} /> : (
        <>
          {!last ? <EmptyState icon={<Moon />} title="No sleep logged yet" text="Log last night’s sleep to see your score and recovery." action={<Button onClick={() => setOpen(true)}>Log sleep</Button>} /> : (
            <div className="grid grid-cols-2 gap-3">
              <Card className="bg-sleep border-0"><p className="text-xs font-semibold text-ink/70">Sleep score</p><p className="tabular text-3xl font-extrabold text-ink">{score ?? '—'}</p>{score != null && <p className="text-xs text-ink/70">{labelFor(score)}</p>}</Card>
              <Card className="bg-card2 border-0"><p className="text-xs font-semibold text-ink2">Sleep duration</p><p className="tabular text-3xl font-extrabold">{formatDuration(last.duration_min)}</p><p className="text-xs text-ink2">{last.duration_min >= goal ? 'Goal met' : 'Goal not met'}</p></Card>
            </div>
          )}
          <Card className="grid gap-2"><h2 className="text-sm font-bold">Last 7 nights (hours)</h2><DailyBars data={bars} color="sleep" goal={goal / 60} unit="h" label="Sleep" />{avg != null && <p className="text-xs text-ink2">Average {formatDuration(avg)} per night. Dashed line is your goal.</p>}</Card>
          <Card className="grid gap-2 bg-recovery/40 border-0"><h2 className="text-sm font-bold text-ink">Recovery</h2><p className="tabular text-2xl font-extrabold text-ink">{recovery ?? '—'}<small className="text-sm font-medium">/100</small></p><p className="text-sm text-ink/80">{advice}</p><p className="text-xs text-ink/70">Training in the last 3 days: {trainMin} min.</p></Card>
          <Button onClick={() => setOpen(true)}>{last?.sleep_date === localISODate() ? 'Update last night' : 'Log last night’s sleep'}</Button>
          {sleep.data && sleep.data.length > 0 && <Notice text="Sleep stages (deep, REM, light) appear when your band data is imported on the Health page." />}
        </>
      )}
      <Sheet open={open} title="Log sleep" onClose={() => setOpen(false)}>
        <div className="grid gap-4">
          <Stepper value={hours} step={0.25} min={1} max={16} unit="hours" onChange={setHours} />
          <ChoiceRow<NonNullable<SleepEntry['rested']>> label="How rested do you feel?" value={rested} onChange={setRested} options={[{ id: 'poor', label: 'Poor' }, { id: 'ok', label: 'OK' }, { id: 'good', label: 'Good' }, { id: 'great', label: 'Great' }]} />
          {err && <Notice text={err} tone="bad" />}
          <Button busy={busy} onClick={() => void save()}>Save</Button>
        </div>
      </Sheet>
    </div>
  )
}
