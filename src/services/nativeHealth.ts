import { supabase } from './supabase'
import type { MetricType, Profile } from '../types'
import { localISODate } from '../utils/dates'

/**
 * Reads health data from the phone's Health Connect (Android) or HealthKit (iOS)
 * through the native Capacitor "Health" plugin, and stores it in health_data / sleep_data.
 * On the plain website there is no plugin, so every function reports "not available".
 * The plugin is reached through window.Capacitor so the web build has no dependency on it.
 */

type DataType = 'steps' | 'calories' | 'heartRate' | 'restingHeartRate' | 'oxygenSaturation'
  | 'respiratoryRate' | 'heartRateVariability' | 'weight' | 'sleep'

interface Sample { value: number; unit?: string; startDate: string; endDate: string; sourceName?: string; sleepState?: string; stages?: { startDate: string; endDate: string; stage?: string; state?: string; sleepState?: string }[] }
interface Agg { startDate: string; endDate: string; value: number; values?: Record<string, number> }
interface HealthPlugin {
  isAvailable(): Promise<{ available: boolean; platform?: string; reason?: string }>
  requestAuthorization(o: { read: DataType[]; write: DataType[] }): Promise<{ readAuthorized: string[]; readDenied: string[] }>
  checkAuthorization(o: { read: DataType[]; write: DataType[] }): Promise<{ readAuthorized: string[]; readDenied: string[] }>
  readSamples(o: { dataType: DataType; startDate: string; endDate: string; limit?: number }): Promise<{ samples: Sample[] }>
  queryAggregated(o: { dataType: DataType; startDate: string; endDate: string; bucket: string; aggregation: string }): Promise<{ samples: Agg[] }>
}
interface CapacitorGlobal { isNativePlatform?: () => boolean; getPlatform?: () => string; Plugins?: Record<string, unknown> }

const READ: DataType[] = ['steps', 'calories', 'heartRate', 'restingHeartRate', 'oxygenSaturation', 'respiratoryRate', 'heartRateVariability', 'weight', 'sleep']
const KEY = 'f4l_native_sync'

function cap(): CapacitorGlobal | null {
  const c = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor
  return c?.isNativePlatform?.() ? c : null
}
function plugin(): HealthPlugin | null {
  return (cap()?.Plugins?.Health as HealthPlugin | undefined) ?? null
}
export const isNativeApp = (): boolean => cap() != null
const platformSource = (): string => (cap()?.getPlatform?.() === 'ios' ? 'healthkit' : 'health_connect')
export const platformLabel = (): string => (cap()?.getPlatform?.() === 'ios' ? 'Apple Health' : 'Health Connect')

export interface SyncSummary { at: string; counts: Record<string, number>; sources: string[]; errors: string[] }

export function lastSync(): SyncSummary | null {
  try { const v = localStorage.getItem(KEY); return v ? (JSON.parse(v) as SyncSummary) : null } catch { return null }
}

export async function nativeStatus(): Promise<{ ok: boolean; reason?: string }> {
  const h = plugin()
  if (!h) return { ok: false, reason: 'This is the website. Install the Android app to sync your phone and watch.' }
  try {
    const a = await h.isAvailable()
    return a.available ? { ok: true } : { ok: false, reason: a.reason || `${platformLabel()} is not available on this phone.` }
  } catch (e) { return { ok: false, reason: e instanceof Error ? e.message : 'Health plugin error.' } }
}

export async function isAuthorized(): Promise<boolean> {
  const h = plugin()
  if (!h) return false
  try { const r = await h.checkAuthorization({ read: READ, write: [] }); return r.readAuthorized.length > 0 } catch { return false }
}

/** Asks for read permission. Returns the data types that were allowed. */
export async function connectHealth(): Promise<string[]> {
  const h = plugin()
  if (!h) throw new Error('Health sync only works inside the mobile app.')
  const r = await h.requestAuthorization({ read: READ, write: [] })
  return r.readAuthorized
}

const RANGE: Record<MetricType, [number, number]> = {
  steps: [0, 200000], calories_burned: [0, 20000], heart_rate: [25, 250], resting_hr: [25, 150], spo2: [50, 100],
  stress: [0, 100], respiratory_rate: [4, 60], hrv: [1, 400], weight_kg: [20, 400],
}
const valid = (m: MetricType, v: number) => Number.isFinite(v) && v >= RANGE[m][0] && v <= RANGE[m][1]
const isoOk = (s: string) => !Number.isNaN(new Date(s).getTime())

/** Daily totals get a timestamp inside that day (noon, or now if noon has not happened yet). */
function dayStamp(dateKey: string): string {
  const noon = new Date(`${dateKey}T12:00:00`)
  return (noon.getTime() > Date.now() ? new Date() : noon).toISOString()
}

interface Row { metric_type: MetricType; value: number; unit: string; recorded_at: string; external_record_id: string }

function kg(s: Sample): number {
  const u = (s.unit ?? '').toLowerCase()
  if (u.includes('pound') || u === 'lb' || u === 'lbs') return s.value * 0.45359237
  if (u.includes('gram') && !u.includes('kilo')) return s.value / 1000
  return s.value
}

interface SleepDay { minutes: number; deep: number; rem: number; light: number; awake: number; bed: number; wake: number }

function sleepByDate(samples: Sample[]): Map<string, SleepDay> {
  // Group by source app first so two apps recording the same night are not added together.
  const bySource = new Map<string, Map<string, SleepDay>>()
  const add = (src: string, startIso: string, endIso: string, state: string) => {
    const s = new Date(startIso).getTime(), e = new Date(endIso).getTime()
    if (!(e > s)) return
    const min = (e - s) / 60000
    const day = localISODate(new Date(endIso))
    const days = bySource.get(src) ?? new Map<string, SleepDay>()
    const d = days.get(day) ?? { minutes: 0, deep: 0, rem: 0, light: 0, awake: 0, bed: s, wake: e }
    if (state === 'awake') d.awake += min
    else if (state === 'inBed') d.minutes += 0
    else { d.minutes += min; if (state === 'deep') d.deep += min; else if (state === 'rem') d.rem += min; else if (state === 'light') d.light += min }
    d.bed = Math.min(d.bed, s); d.wake = Math.max(d.wake, e)
    days.set(day, d); bySource.set(src, days)
  }
  for (const s of samples) {
    const src = s.sourceName ?? 'unknown'
    if (s.stages?.length) for (const g of s.stages) add(src, g.startDate, g.endDate, g.stage ?? g.state ?? g.sleepState ?? 'asleep')
    else add(src, s.startDate, s.endDate, s.sleepState ?? 'asleep')
  }
  const best = new Map<string, SleepDay>()
  for (const days of bySource.values()) for (const [k, v] of days) if (!best.has(k) || v.minutes > (best.get(k) as SleepDay).minutes) best.set(k, v)
  return best
}

/** Reads the last `days` days from the phone and stores them. Safe to run repeatedly: rows are upserted on a stable id. */
export async function syncNativeHealth(p: Profile, days = 7): Promise<SyncSummary> {
  const h = plugin()
  if (!h) throw new Error('Health sync only works inside the mobile app.')
  const end = new Date()
  const start = new Date(); start.setDate(start.getDate() - (days - 1)); start.setHours(0, 0, 0, 0)
  const range = { startDate: start.toISOString(), endDate: end.toISOString() }
  const source = platformSource()
  const sum: SyncSummary = { at: end.toISOString(), counts: {}, sources: [], errors: [] }
  const seen = new Set<string>()
  const rows: Row[] = []
  const note = (s?: Sample) => { if (s?.sourceName) seen.add(s.sourceName) }
  const guard = async (name: string, fn: () => Promise<void>) => { try { await fn() } catch (e) { sum.errors.push(`${name}: ${e instanceof Error ? e.message : 'failed'}`) } }

  const daily = async (dt: DataType, metric: MetricType, unit: string, agg: 'sum' | 'average', round = true) => {
    const r = await h.queryAggregated({ dataType: dt, ...range, bucket: 'day', aggregation: agg })
    for (const a of r.samples) {
      const v = a.values?.[agg] ?? a.value
      const value = round ? Math.round(v) : v
      if (!isoOk(a.startDate) || !valid(metric, value) || value === 0) continue
      const key = localISODate(new Date(a.startDate))
      rows.push({ metric_type: metric, value, unit, recorded_at: dayStamp(key), external_record_id: `${dt}:${key}` })
    }
  }
  const points = async (dt: DataType, metric: MetricType, unit: string, tf: (s: Sample) => number, limit = 100) => {
    const r = await h.readSamples({ dataType: dt, ...range, limit })
    for (const s of r.samples) {
      const value = Math.round(tf(s) * 10) / 10
      if (!isoOk(s.startDate) || !valid(metric, value)) continue
      note(s)
      rows.push({ metric_type: metric, value, unit, recorded_at: new Date(s.startDate).toISOString(), external_record_id: `${dt}:${new Date(s.startDate).toISOString()}` })
    }
  }

  await guard('steps', () => daily('steps', 'steps', 'count', 'sum'))
  await guard('calories', () => daily('calories', 'calories_burned', 'kcal', 'sum'))
  await guard('heart rate', async () => {
    const two = { startDate: new Date(Date.now() - 2 * 864e5).toISOString(), endDate: end.toISOString() }
    const r = await h.queryAggregated({ dataType: 'heartRate', ...two, bucket: 'hour', aggregation: 'average' })
    for (const a of r.samples) {
      const value = Math.round(a.values?.average ?? a.value)
      if (isoOk(a.startDate) && valid('heart_rate', value)) rows.push({ metric_type: 'heart_rate', value, unit: 'bpm', recorded_at: new Date(a.startDate).toISOString(), external_record_id: `hr:${new Date(a.startDate).toISOString()}` })
    }
  })
  await guard('resting heart rate', () => points('restingHeartRate', 'resting_hr', 'bpm', (s) => s.value, 30))
  await guard('SpO2', () => points('oxygenSaturation', 'spo2', '%', (s) => (s.value <= 1 ? s.value * 100 : s.value), 30))
  await guard('respiration', () => points('respiratoryRate', 'respiratory_rate', '/min', (s) => s.value, 30))
  await guard('HRV', () => points('heartRateVariability', 'hrv', 'ms', (s) => s.value, 30))
  await guard('weight', () => points('weight', 'weight_kg', 'kg', kg, 10))

  const toSave = new Map(rows.map((r) => [`${r.metric_type}|${r.external_record_id}`, r]))
  const list = [...toSave.values()].map((r) => ({ ...r, user_id: p.id, gym_id: p.gym_id, source }))
  for (let i = 0; i < list.length; i += 500) {
    const chunk = list.slice(i, i + 500)
    const { error } = await supabase.from('health_data').upsert(chunk, { onConflict: 'user_id,source,external_record_id' })
    if (error) { sum.errors.push(error.message); break }
    for (const r of chunk) sum.counts[r.metric_type] = (sum.counts[r.metric_type] ?? 0) + 1
  }

  await guard('sleep', async () => {
    const r = await h.readSamples({ dataType: 'sleep', startDate: new Date(start.getTime() - 864e5).toISOString(), endDate: range.endDate, limit: 1000 })
    r.samples.forEach(note)
    const out = [...sleepByDate(r.samples)].filter(([, d]) => d.minutes >= 20 && d.minutes <= 1440).map(([date, d]) => ({
      user_id: p.id, gym_id: p.gym_id, sleep_date: date, duration_min: Math.round(d.minutes),
      deep_min: d.deep ? Math.round(d.deep) : null, rem_min: d.rem ? Math.round(d.rem) : null, light_min: d.light ? Math.round(d.light) : null, awake_min: d.awake ? Math.round(d.awake) : null,
      bedtime: new Date(d.bed).toISOString(), wake_time: new Date(d.wake).toISOString(), source,
    }))
    if (!out.length) return
    const { error } = await supabase.from('sleep_data').upsert(out, { onConflict: 'user_id,sleep_date,source' })
    if (error) throw new Error(error.message)
    sum.counts.sleep = out.length
  })

  sum.sources = [...seen]
  try { localStorage.setItem(KEY, JSON.stringify(sum)) } catch { /* private mode: nothing to remember */ }
  return sum
}
