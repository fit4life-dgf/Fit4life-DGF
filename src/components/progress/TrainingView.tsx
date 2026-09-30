import { useMemo, useState } from 'react'
import { useAsync } from '../../hooks/useAsync'
import { fetchLibrary, fetchSessionRange, fetchSetRows, muscleMapOf } from '../../services/workoutSystem'
import { bucketVolume, e1rm, muscleLoad } from '../../utils/workoutMath'
import { formatNumber } from '../../utils/format'
import { Card } from '../ui/Card'
import { Segmented } from '../ui/Segmented'
import { ErrorBox, LoadingBlocks } from '../ui/StateViews'
import { DailyBars, TrendArea } from './Charts'
import { muscleName } from '../muscle3d/muscleMap'

type Range = '7' | '30' | '90' | '365'

/** Training analytics: sessions, volume, records, muscle balance and strength trend for 7 days to a year. Also used by trainers for a client. */
export function TrainingView({ userId }: { userId: string }) {
  const [range, setRange] = useState<Range>('30')
  const days = Number(range)
  const sets = useAsync(() => fetchSetRows(userId, days), [userId, days])
  const sessions = useAsync(() => fetchSessionRange(userId, days), [userId, days])
  const lib = useAsync(fetchLibrary, [])
  const [pick, setPick] = useState<string>('')

  const exNames = useMemo(() => {
    const c = new Map<string, number>()
    for (const r of sets.data ?? []) if (r.weight_kg && r.reps) c.set(r.exercise_name, (c.get(r.exercise_name) ?? 0) + 1)
    return [...c.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n)
  }, [sets.data])
  const exercise = exNames.includes(pick) ? pick : exNames[0] ?? ''

  const trend = useMemo(() => {
    const best = new Map<string, number>()
    for (const r of sets.data ?? []) {
      if (r.exercise_name !== exercise) continue
      const d = new Date(r.created_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const v = e1rm(r.weight_kg ?? 0, r.reps ?? 0)
      if (v > (best.get(key) ?? 0)) best.set(key, v)
    }
    return [...best.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, value]) => ({ date, value }))
  }, [sets.data, exercise])

  const loads = useMemo(() => {
    if (!sets.data || !lib.data) return []
    const l = muscleLoad(sets.data.map((r) => ({ exerciseId: r.exercise_id })), muscleMapOf(lib.data))
    return Object.entries(l).sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [sets.data, lib.data])

  const header = <Segmented<Range> label="Range" value={range} onChange={setRange} options={[{ id: '7', label: '7 days' }, { id: '30', label: '30 days' }, { id: '90', label: '90 days' }, { id: '365', label: '1 year' }]} />
  if (sets.loading || sessions.loading) return <div className="grid gap-4">{header}<LoadingBlocks n={2} /></div>
  const err = sets.error ?? sessions.error
  if (err) return <div className="grid gap-4">{header}<ErrorBox message={err} onRetry={() => { void sets.reload(); void sessions.reload() }} /></div>

  const ses = sessions.data ?? []
  const rows = sets.data ?? []
  const volume = rows.reduce((a, r) => a + (r.reps ?? 0) * (r.weight_kg ?? 0), 0)
  const prs = rows.filter((r) => r.is_pr).length
  const avgMin = ses.length ? Math.round(ses.reduce((a, s) => a + (s.duration_min ?? 0), 0) / ses.length) : 0
  const maxLoad = loads.length ? loads[0][1] : 1

  return (
    <div className="grid gap-4">
      {header}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-workout/40 border-0"><p className="text-xs font-semibold text-ink/70">Workouts</p><p className="tabular text-3xl font-extrabold text-ink">{ses.length}</p></Card>
        <Card className="bg-card2 border-0"><p className="text-xs font-semibold text-ink2">Total volume</p><p className="tabular text-2xl font-extrabold">{formatNumber(volume)}<small className="ml-1 text-xs font-medium text-ink2">kg</small></p></Card>
        <Card className="bg-card2 border-0"><p className="text-xs font-semibold text-ink2">Average length</p><p className="tabular text-2xl font-extrabold">{avgMin}<small className="ml-1 text-xs font-medium text-ink2">min</small></p></Card>
        <Card className="bg-recovery/50 border-0"><p className="text-xs font-semibold text-ink/70">Personal records</p><p className="tabular text-3xl font-extrabold text-ink">{prs}</p></Card>
      </div>
      <Card className="grid gap-2"><h2 className="text-sm font-bold">Training volume{days > 31 ? ' per week' : ' per day'}</h2>
        <DailyBars data={bucketVolume(rows, days)} color="workout" unit="kg" label="Volume" /></Card>
      <Card className="grid gap-3"><h2 className="text-sm font-bold">Muscle balance (weighted sets)</h2>
        {!loads.length ? <p className="text-sm text-ink2">No strength sets in this period.</p> : (
          <ul className="grid gap-2">{loads.map(([id, v]) => (
            <li key={id} className="grid gap-1"><div className="flex justify-between text-sm"><span className="font-semibold">{muscleName(id)}</span><span className="tabular text-xs text-ink2">{Math.round(v * 10) / 10}</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-card2"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(4, (v / maxLoad) * 100)}%` }} /></div></li>))}</ul>
        )}
      </Card>
      <Card className="grid gap-3"><h2 className="text-sm font-bold">Strength trend (estimated 1RM)</h2>
        {!exNames.length ? <p className="text-sm text-ink2">Log weighted sets to see a strength trend.</p> : (
          <>
            <label className="grid gap-1 text-xs font-semibold text-ink2">Exercise
              <select value={exercise} onChange={(e) => setPick(e.target.value)} className="min-h-[44px] rounded-tile border border-line bg-bg px-3 text-sm font-normal text-ink">{exNames.map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
            <TrendArea data={trend} unit="kg" label="Estimated 1RM" />
          </>
        )}
      </Card>
    </div>
  )
}
