import { supabase } from './supabase'
import type { GoalTargets, MetricType, Profile, SleepRecord, TodayData, WorkoutToday } from '../types'
import { localISODate, startOfToday } from '../utils/dates'

export const DEFAULT_GOALS: GoalTargets = { steps: 10000, water_ml: 3500, calories: 600, sleep_min: 480 }

interface HealthRow { metric_type: MetricType; value: number; recorded_at: string }
interface DayRow {
  day_of_week: number
  name: string
  focus: string
  est_minutes: number | null
  workout_exercises: { id: string }[] | null
}
interface PlanRow { name: string; workout_days: DayRow[] | null }

function fail(message: string): never {
  throw new Error(message)
}

export async function fetchToday(userId: string): Promise<TodayData> {
  const start = startOfToday().toISOString()
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString()

  const [hd, rhr, sl, wl, gl, wp] = await Promise.all([
    supabase.from('health_data').select('metric_type,value,recorded_at').eq('user_id', userId).gte('recorded_at', start),
    supabase.from('health_data').select('value').eq('user_id', userId).eq('metric_type', 'resting_hr')
      .gte('recorded_at', weekAgo).order('recorded_at', { ascending: false }).limit(1),
    supabase.from('sleep_data').select('*').eq('user_id', userId).order('sleep_date', { ascending: false }).limit(1),
    supabase.from('water_logs').select('amount_ml').eq('user_id', userId).gte('logged_at', start),
    supabase.from('goals').select('type,target').eq('user_id', userId).eq('active', true),
    supabase.from('workout_plans')
      .select('name,workout_days(day_of_week,name,focus,est_minutes,workout_exercises(id))')
      .eq('user_id', userId).eq('active', true).limit(1),
  ])
  for (const r of [hd, rhr, sl, wl, gl, wp]) if (r.error) fail(r.error.message)

  const rows = (hd.data ?? []) as HealthRow[]
  const sum = (t: MetricType) => rows.filter((r) => r.metric_type === t).reduce((s, r) => s + Number(r.value), 0)
  const latest = (t: MetricType): number | null => {
    const m = rows.filter((r) => r.metric_type === t).sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))[0]
    return m ? Number(m.value) : null
  }

  const goals: GoalTargets = { ...DEFAULT_GOALS }
  for (const g of (gl.data ?? []) as { type: string; target: number }[]) {
    if (g.type === 'steps') goals.steps = Number(g.target)
    if (g.type === 'water_ml') goals.water_ml = Number(g.target)
    if (g.type === 'calories') goals.calories = Number(g.target)
    if (g.type === 'sleep_min') goals.sleep_min = Number(g.target)
  }

  const sleep = ((sl.data ?? [])[0] ?? null) as SleepRecord | null
  const waterMl = ((wl.data ?? []) as { amount_ml: number }[]).reduce((s, r) => s + r.amount_ml, 0)
  const restingRow = ((rhr.data ?? [])[0] ?? null) as { value: number } | null

  let workout: WorkoutToday | null = null
  const plan = ((wp.data ?? [])[0] ?? null) as PlanRow | null
  if (plan?.workout_days) {
    const day = plan.workout_days.find((d) => d.day_of_week === new Date().getDay())
    if (day) {
      workout = {
        planName: plan.name,
        dayName: day.name,
        focus: day.focus,
        exerciseCount: day.workout_exercises?.length ?? 0,
        estMinutes: day.est_minutes,
      }
    }
  }

  const steps = sum('steps')
  const calories = sum('calories_burned')
  const heartRate = latest('heart_rate')
  return {
    steps,
    calories,
    heartRate,
    restingHr: restingRow ? Number(restingRow.value) : null,
    waterMl,
    sleep,
    goals,
    workout,
    hasAnyData: steps > 0 || calories > 0 || heartRate != null || waterMl > 0 || sleep != null,
  }
}

async function insert(table: string, row: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from(table).insert(row)
  if (error) fail(error.message)
}

export function logWater(p: Profile, amountMl: number): Promise<void> {
  return insert('water_logs', { user_id: p.id, gym_id: p.gym_id, amount_ml: amountMl })
}

export function logMetric(p: Profile, metric: MetricType, value: number, unit: string): Promise<void> {
  return insert('health_data', {
    user_id: p.id, gym_id: p.gym_id, metric_type: metric, value, unit, source: 'manual',
  })
}

export async function logSleep(p: Profile, hours: number): Promise<void> {
  const { error } = await supabase.from('sleep_data').upsert(
    {
      user_id: p.id, gym_id: p.gym_id, sleep_date: localISODate(), duration_min: Math.round(hours * 60), source: 'manual',
    },
    { onConflict: 'user_id,sleep_date,source' },
  )
  if (error) fail(error.message)
}

/* ---------- Phase 4/5: vitals, sleep detail, imports ---------- */
export const VITALS = [
  { metric: 'spo2' as MetricType, label: 'SpO2', unit: '%', min: 70, max: 100, def: 97, step: 1 },
  { metric: 'stress' as MetricType, label: 'Stress', unit: '/100', min: 0, max: 100, def: 30, step: 5 },
  { metric: 'hrv' as MetricType, label: 'HRV', unit: 'ms', min: 5, max: 250, def: 50, step: 1 },
  { metric: 'respiratory_rate' as MetricType, label: 'Respiration', unit: '/min', min: 6, max: 40, def: 15, step: 1 },
  { metric: 'resting_hr' as MetricType, label: 'Resting HR', unit: 'bpm', min: 30, max: 120, def: 60, step: 1 },
]

export async function fetchLatestVitals(userId: string): Promise<Record<string, { value: number; at: string } | undefined>> {
  const { data, error } = await supabase.from('health_data').select('metric_type,value,recorded_at')
    .eq('user_id', userId).in('metric_type', VITALS.map((v) => v.metric)).order('recorded_at', { ascending: false }).limit(200)
  if (error) fail(error.message)
  const out: Record<string, { value: number; at: string } | undefined> = {}
  for (const r of (data ?? []) as { metric_type: string; value: number; recorded_at: string }[]) {
    if (!out[r.metric_type]) out[r.metric_type] = { value: Number(r.value), at: r.recorded_at }
  }
  return out
}

export interface SleepEntry { hours: number; rested: 'poor' | 'ok' | 'good' | 'great' | null }
const REST_SCORE = { poor: 40, ok: 60, good: 80, great: 95 } as const

/** Manual sleep entry. The "how rested" rating is the member's own and is stored as the score only when given. */
export async function logSleepDetailed(p: Profile, e: SleepEntry, date: string = localISODate()): Promise<void> {
  const { error } = await supabase.from('sleep_data').upsert(
    { user_id: p.id, gym_id: p.gym_id, sleep_date: date, duration_min: Math.round(e.hours * 60), score: e.rested ? REST_SCORE[e.rested] : null, source: 'manual' },
    { onConflict: 'user_id,sleep_date,source' },
  )
  if (error) fail(error.message)
}

export async function fetchRecentSleep(userId: string, days = 7): Promise<SleepRecord[]> {
  const since = new Date(); since.setDate(since.getDate() - (days - 1))
  const { data, error } = await supabase.from('sleep_data').select('*').eq('user_id', userId).gte('sleep_date', localISODate(since)).order('sleep_date')
  if (error) fail(error.message)
  return (data ?? []) as SleepRecord[]
}

const METRICS: MetricType[] = ['steps', 'calories_burned', 'heart_rate', 'resting_hr', 'spo2', 'stress', 'respiratory_rate', 'hrv', 'weight_kg']
const RANGE: Record<MetricType, [number, number]> = {
  steps: [0, 200000], calories_burned: [0, 20000], heart_rate: [25, 250], resting_hr: [25, 150], spo2: [50, 100],
  stress: [0, 100], respiratory_rate: [4, 60], hrv: [1, 400], weight_kg: [20, 400],
}
export interface ImportResult { imported: number; skipped: number; errors: string[] }

/**
 * Imports health data from a CSV exported from a band/app.
 * Columns: metric_type,value,recorded_at[,unit][,external_record_id]. Re-importing the same file is safe (deduplicated by external id, or a derived id).
 */
export async function importHealthCsv(p: Profile, text: string): Promise<ImportResult> {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const res: ImportResult = { imported: 0, skipped: 0, errors: [] }
  if (lines.length < 2) { res.errors.push('The file has no data rows.'); return res }
  const head = lines[0].split(',').map((h) => h.trim().toLowerCase())
  const ix = (n: string) => head.indexOf(n)
  const [im, iv, it, iu, ie] = [ix('metric_type'), ix('value'), ix('recorded_at'), ix('unit'), ix('external_record_id')]
  if (im < 0 || iv < 0 || it < 0) { res.errors.push('Header must include metric_type, value and recorded_at.'); return res }
  const rows: Record<string, unknown>[] = []
  lines.slice(1, 5001).forEach((line, n) => {
    const c = line.split(',').map((x) => x.trim())
    const metric = c[im] as MetricType
    const value = Number(c[iv])
    const when = new Date(c[it])
    if (!METRICS.includes(metric)) { res.skipped++; if (res.errors.length < 5) res.errors.push(`Row ${n + 2}: unknown metric "${c[im]}".`); return }
    if (!Number.isFinite(value) || value < RANGE[metric][0] || value > RANGE[metric][1]) { res.skipped++; if (res.errors.length < 5) res.errors.push(`Row ${n + 2}: value out of range.`); return }
    if (Number.isNaN(when.getTime())) { res.skipped++; if (res.errors.length < 5) res.errors.push(`Row ${n + 2}: bad date.`); return }
    rows.push({
      user_id: p.id, gym_id: p.gym_id, metric_type: metric, value, unit: iu >= 0 ? c[iu] || null : null,
      recorded_at: when.toISOString(), source: 'import', external_record_id: (ie >= 0 && c[ie]) || `${metric}:${when.toISOString()}`,
    })
  })
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500)
    const { error } = await supabase.from('health_data').upsert(chunk, { onConflict: 'user_id,source,external_record_id' })
    if (error) { res.errors.push(error.message); res.skipped += chunk.length } else res.imported += chunk.length
  }
  return res
}

export async function saveGoal(p: Profile, type: 'steps' | 'water_ml' | 'calories' | 'sleep_min', target: number): Promise<void> {
  const { error } = await supabase.from('goals').upsert({ user_id: p.id, gym_id: p.gym_id, type, target, active: true }, { onConflict: 'user_id,type' })
  if (error) fail(error.message)
}
