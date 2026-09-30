import { useState } from 'react'
import type { Profile } from '../../types'
import { fetchMetricSeries, fetchSleepSeries, fetchWaterSeries } from '../../services/progress'
import { fetchGoals } from '../../services/goals'
import { useAsync } from '../../hooks/useAsync'
import { Card } from '../ui/Card'
import { Segmented } from '../ui/Segmented'
import { ErrorBox, LoadingBlocks } from '../ui/StateViews'
import { DailyBars } from './Charts'

type Range = '7' | '30'

export function TrendsView({ profile }: { profile: Profile }) {
  const [range, setRange] = useState<Range>('7')
  const n = Number(range)
  const goals = useAsync(() => fetchGoals(profile.id), [profile.id])
  const steps = useAsync(() => fetchMetricSeries(profile.id, 'steps', n, 'sum'), [profile.id, n])
  const cals = useAsync(() => fetchMetricSeries(profile.id, 'calories_burned', n, 'sum'), [profile.id, n])
  const hr = useAsync(() => fetchMetricSeries(profile.id, 'resting_hr', n, 'avg'), [profile.id, n])
  const water = useAsync(() => fetchWaterSeries(profile.id, n), [profile.id, n])
  const sleep = useAsync(() => fetchSleepSeries(profile.id, n), [profile.id, n])

  const err = steps.error ?? cals.error ?? water.error ?? sleep.error ?? hr.error
  if (err) return <ErrorBox message={err} onRetry={() => { void steps.reload(); void cals.reload(); void water.reload(); void sleep.reload(); void hr.reload() }} />
  const loading = steps.loading || cals.loading || water.loading || sleep.loading || hr.loading
  const g = goals.data
  const sleepPts = (sleep.data ?? []).map((r) => ({ date: r.date, value: Math.round((r.minutes / 60) * 10) / 10 }))
  const avg = (a: { value: number }[]) => { const v = a.filter((x) => x.value > 0); return v.length ? Math.round(v.reduce((s, x) => s + x.value, 0) / v.length) : 0 }

  return (
    <div className="grid gap-4">
      <Segmented<Range> label="Range" value={range} onChange={setRange} options={[{ id: '7', label: '7 days' }, { id: '30', label: '30 days' }]} />
      {loading ? <LoadingBlocks n={3} h="h-52" /> : (
        <>
          <Card className="grid gap-2"><div className="flex justify-between"><h2 className="text-sm font-bold">Steps</h2><span className="text-xs text-ink2">avg {avg(steps.data ?? []).toLocaleString('en-IN')}/day</span></div><DailyBars data={steps.data ?? []} color="steps" goal={g?.steps} unit="steps" label="Steps" /></Card>
          <Card className="grid gap-2"><div className="flex justify-between"><h2 className="text-sm font-bold">Calories burned</h2><span className="text-xs text-ink2">avg {avg(cals.data ?? [])}/day</span></div><DailyBars data={cals.data ?? []} color="calories" goal={g?.calories} unit="kcal" label="Calories" /></Card>
          <Card className="grid gap-2"><h2 className="text-sm font-bold">Sleep (hours)</h2><DailyBars data={sleepPts} color="sleep" goal={g ? g.sleep_min / 60 : undefined} unit="h" label="Sleep" /></Card>
          <Card className="grid gap-2"><h2 className="text-sm font-bold">Water</h2><DailyBars data={water.data ?? []} color="water" goal={g?.water_ml} unit="ml" label="Water" /></Card>
          <Card className="grid gap-2"><h2 className="text-sm font-bold">Resting heart rate</h2><DailyBars data={hr.data ?? []} color="heart" unit="bpm" label="Resting heart rate" /></Card>
        </>
      )}
    </div>
  )
}
