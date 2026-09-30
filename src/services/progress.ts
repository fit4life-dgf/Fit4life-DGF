import { supabase } from './supabase'
import type { DayPoint, Measurement, MetricType, Profile, ProgressPhoto } from '../types'
import { localISODate } from '../utils/dates'
import { currentStreak } from '../utils/achievements'

function fail(message: string): never { throw new Error(message) }

export async function fetchMeasurements(userId: string): Promise<Measurement[]> {
  const { data, error } = await supabase.from('body_measurements')
    .select('id,measured_on,weight_kg,body_fat_pct,chest_cm,waist_cm,hips_cm,arm_cm,thigh_cm')
    .eq('user_id', userId).order('measured_on', { ascending: true })
  if (error) fail(error.message)
  return ((data ?? []) as Measurement[]).map((m) => ({ ...m, weight_kg: m.weight_kg == null ? null : Number(m.weight_kg) }))
}

export async function saveMeasurement(p: Profile, m: Partial<Omit<Measurement, 'id' | 'measured_on'>>, on: string = localISODate()): Promise<void> {
  const { error } = await supabase.from('body_measurements').upsert({ user_id: p.id, gym_id: p.gym_id, measured_on: on, ...m }, { onConflict: 'user_id,measured_on' })
  if (error) fail(error.message)
  if (m.weight_kg != null) {
    const r = await supabase.from('members').update({ weight_kg: m.weight_kg }).eq('user_id', p.id)
    if (r.error) fail(r.error.message)
  }
}

/** Daily totals (sum) or daily latest for a metric over the last `days` days, oldest first. */
export async function fetchMetricSeries(userId: string, metric: MetricType, days: number, mode: 'sum' | 'avg'): Promise<DayPoint[]> {
  const since = new Date(); since.setHours(0, 0, 0, 0); since.setDate(since.getDate() - (days - 1))
  const { data, error } = await supabase.from('health_data').select('value,recorded_at')
    .eq('user_id', userId).eq('metric_type', metric).gte('recorded_at', since.toISOString()).limit(5000)
  if (error) fail(error.message)
  const by = new Map<string, number[]>()
  for (const r of (data ?? []) as { value: number; recorded_at: string }[]) {
    const k = localISODate(new Date(r.recorded_at))
    by.set(k, [...(by.get(k) ?? []), Number(r.value)])
  }
  const out: DayPoint[] = []
  for (let i = 0; i < days; i++) {
    const d = new Date(since); d.setDate(since.getDate() + i)
    const k = localISODate(d)
    const v = by.get(k)
    out.push({ date: k, value: v ? Math.round(mode === 'sum' ? v.reduce((a, b) => a + b, 0) : v.reduce((a, b) => a + b, 0) / v.length) : 0 })
  }
  return out
}

export async function fetchSleepSeries(userId: string, days: number): Promise<{ date: string; minutes: number; score: number | null }[]> {
  const since = new Date(); since.setDate(since.getDate() - (days - 1))
  const { data, error } = await supabase.from('sleep_data').select('sleep_date,duration_min,score')
    .eq('user_id', userId).gte('sleep_date', localISODate(since)).order('sleep_date')
  if (error) fail(error.message)
  return ((data ?? []) as { sleep_date: string; duration_min: number; score: number | null }[]).map((r) => ({ date: r.sleep_date, minutes: r.duration_min, score: r.score }))
}

export async function fetchWaterSeries(userId: string, days: number): Promise<DayPoint[]> {
  const since = new Date(); since.setHours(0, 0, 0, 0); since.setDate(since.getDate() - (days - 1))
  const { data, error } = await supabase.from('water_logs').select('amount_ml,logged_at').eq('user_id', userId).gte('logged_at', since.toISOString()).limit(5000)
  if (error) fail(error.message)
  const by = new Map<string, number>()
  for (const r of (data ?? []) as { amount_ml: number; logged_at: string }[]) {
    const k = localISODate(new Date(r.logged_at)); by.set(k, (by.get(k) ?? 0) + r.amount_ml)
  }
  return Array.from({ length: days }, (_, i) => { const d = new Date(since); d.setDate(since.getDate() + i); const k = localISODate(d); return { date: k, value: by.get(k) ?? 0 } })
}

/* ---------- photos ---------- */
export async function fetchPhotos(userId: string): Promise<ProgressPhoto[]> {
  const { data, error } = await supabase.from('progress_photos').select('id,taken_on,storage_path,note').eq('user_id', userId).order('taken_on', { ascending: false })
  if (error) fail(error.message)
  const rows = (data ?? []) as ProgressPhoto[]
  if (!rows.length) return rows
  const signed = await supabase.storage.from('fit-photos').createSignedUrls(rows.map((r) => r.storage_path), 3600)
  const urls = new Map((signed.data ?? []).map((s) => [s.path ?? '', s.signedUrl]))
  return rows.map((r): ProgressPhoto => ({ ...r, url: urls.get(r.storage_path) ?? undefined }))
}

const MAX_PHOTO_BYTES = 8 * 1024 * 1024
export async function uploadPhoto(p: Profile, file: File): Promise<void> {
  if (!file.type.startsWith('image/')) fail('Please choose an image file.')
  if (file.size > MAX_PHOTO_BYTES) fail('Image is larger than 8 MB.')
  const ext = file.type === 'image/png' ? 'png' : 'jpg'
  const path = `${p.id}/${Date.now()}.${ext}`
  const up = await supabase.storage.from('fit-photos').upload(path, file, { contentType: file.type })
  if (up.error) fail(up.error.message)
  const { error } = await supabase.from('progress_photos').insert({ user_id: p.id, gym_id: p.gym_id, storage_path: path })
  if (error) { await supabase.storage.from('fit-photos').remove([path]); fail(error.message) }
}

export async function deletePhoto(ph: ProgressPhoto): Promise<void> {
  const r = await supabase.from('progress_photos').delete().eq('id', ph.id)
  if (r.error) fail(r.error.message)
  await supabase.storage.from('fit-photos').remove([ph.storage_path])
}

/* ---------- achievements ---------- */
export async function fetchAchievements(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from('achievements').select('code').eq('user_id', userId)
  if (error) fail(error.message)
  return new Set(((data ?? []) as { code: string }[]).map((r) => r.code))
}

/** Evaluates real data and records any newly earned badges. Returns the codes newly earned. */
export async function evaluateAchievements(p: Profile): Promise<string[]> {
  const [have, sess, steps, water, sleep, meas, att, days] = await Promise.all([
    fetchAchievements(p.id),
    supabase.from('workout_sessions').select('id', { count: 'exact', head: true }).eq('user_id', p.id),
    fetchMetricSeries(p.id, 'steps', 30, 'sum'),
    fetchWaterSeries(p.id, 30),
    fetchSleepSeries(p.id, 30),
    supabase.from('body_measurements').select('id', { count: 'exact', head: true }).eq('user_id', p.id).not('weight_kg', 'is', null),
    supabase.from('attendance').select('id', { count: 'exact', head: true }).eq('user_id', p.id),
    activeDays(p.id, 30),
  ])
  const goal = await supabase.from('goals').select('target').eq('user_id', p.id).eq('type', 'water_ml').eq('active', true).maybeSingle()
  const waterGoal = Number((goal.data as { target: number } | null)?.target ?? 3500)
  const earned: string[] = []
  const check = (code: string, ok: boolean) => { if (ok && !have.has(code)) earned.push(code) }
  const workouts = sess.count ?? 0
  check('first_workout', workouts >= 1)
  check('workouts_10', workouts >= 10)
  check('steps_10k', steps.some((d) => d.value >= 10000))
  check('water_goal', water.some((d) => d.value >= waterGoal))
  check('sleep_8h', sleep.some((d) => d.minutes >= 480))
  check('first_weigh_in', (meas.count ?? 0) >= 1)
  check('attend_12', (att.count ?? 0) >= 12)
  check('streak_7', currentStreak(days) >= 7)
  if (earned.length) {
    const r = await supabase.from('achievements').upsert(earned.map((code) => ({ user_id: p.id, gym_id: p.gym_id, code })), { onConflict: 'user_id,code', ignoreDuplicates: true })
    if (r.error) fail(r.error.message)
  }
  return earned
}

/** Distinct local dates on which the member logged anything (workout, water, food, steps, sleep). */
export async function activeDays(userId: string, days: number): Promise<string[]> {
  const since = new Date(); since.setDate(since.getDate() - days); const iso = since.toISOString()
  const [a, b, c, d] = await Promise.all([
    supabase.from('workout_sessions').select('started_at').eq('user_id', userId).gte('started_at', iso),
    supabase.from('water_logs').select('logged_at').eq('user_id', userId).gte('logged_at', iso),
    supabase.from('food_logs').select('logged_at').eq('user_id', userId).gte('logged_at', iso),
    supabase.from('health_data').select('recorded_at').eq('user_id', userId).gte('recorded_at', iso).limit(5000),
  ])
  const set = new Set<string>()
  for (const r of (a.data ?? []) as { started_at: string }[]) set.add(localISODate(new Date(r.started_at)))
  for (const r of (b.data ?? []) as { logged_at: string }[]) set.add(localISODate(new Date(r.logged_at)))
  for (const r of (c.data ?? []) as { logged_at: string }[]) set.add(localISODate(new Date(r.logged_at)))
  for (const r of (d.data ?? []) as { recorded_at: string }[]) set.add(localISODate(new Date(r.recorded_at)))
  return [...set]
}
