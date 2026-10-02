import { supabase } from './supabase'
import type { Exercise, Profile } from '../types'
import { estimateBurn } from '../utils/energy'
import type { GoalDefaultInput, GoalPrescriptionRow } from '../utils/prescription'
import { e1rm, totalVolume, type ExMuscles, type SetRowLite } from '../utils/workoutMath'

function fail(message: string): never { throw new Error(message) }

/* ---------- Exercise library ---------- */
interface RawLib { id: string; name: string; muscle: string; equipment: string; level: string; cue: string | null; primary_muscle: string | null; instructions: string[] | null; video_url: string | null; common_mistakes: string[] | null; breathing: string | null; tips: string[] | null; animation_url: string | null; animation_clip: string | null; exercise_secondary_muscles: { muscle_id: string; role: string | null }[] | null }

export async function fetchLibrary(): Promise<Exercise[]> {
  const { data, error } = await supabase.from('exercises')
    .select('id,name,muscle,equipment,level,cue,primary_muscle,instructions,video_url,common_mistakes,breathing,tips,animation_url,animation_clip,exercise_secondary_muscles(muscle_id,role)')
    .eq('is_active', true).order('name')
  if (error) fail(error.message)
  return ((data ?? []) as RawLib[]).map((r): Exercise => ({
    id: r.id, name: r.name, muscle: r.muscle, equipment: r.equipment, level: r.level, cue: r.cue,
    primary_muscle: r.primary_muscle, instructions: r.instructions ?? [], video_url: r.video_url,
    secondary: (r.exercise_secondary_muscles ?? []).filter((x) => (x.role ?? 'secondary') === 'secondary').map((x) => x.muscle_id),
    stabilizers: (r.exercise_secondary_muscles ?? []).filter((x) => x.role === 'stabilizer').map((x) => x.muscle_id),
    common_mistakes: r.common_mistakes ?? [], breathing: r.breathing, tips: r.tips ?? [], animation_url: r.animation_url, animation_clip: r.animation_clip,
  }))
}

/* ---------- Training goals and goal defaults (fail soft: before the tables exist the app shows "Not prescribed") ---------- */
export interface TrainingGoal { id: string; name: string }
const FALLBACK_GOALS: TrainingGoal[] = [
  { id: 'hypertrophy', name: 'Hypertrophy' }, { id: 'strength', name: 'Strength' },
  { id: 'endurance', name: 'Muscular endurance' }, { id: 'beginner', name: 'Beginner / general fitness' },
]

export async function fetchTrainingGoals(): Promise<TrainingGoal[]> {
  try {
    const { data, error } = await supabase.from('training_goals').select('id,name').eq('active', true).order('sort')
    if (error || !data?.length) return FALLBACK_GOALS
    return data as TrainingGoal[]
  } catch { return FALLBACK_GOALS }
}

export async function fetchGoalPrescriptions(exerciseId: string): Promise<GoalPrescriptionRow[]> {
  try {
    const { data, error } = await supabase.from('exercise_goal_prescriptions')
      .select('exercise_id,goal_id,sets_min,sets_max,reps_min,reps_max,rest_min_seconds,rest_max_seconds,tempo').eq('exercise_id', exerciseId)
    if (error) return []
    return (data ?? []) as GoalPrescriptionRow[]
  } catch { return [] }
}

export async function saveGoalPrescription(exerciseId: string, goalId: string, v: GoalDefaultInput): Promise<void> {
  const { error } = await supabase.from('exercise_goal_prescriptions').upsert({
    exercise_id: exerciseId, goal_id: goalId, sets_min: v.sets_min, sets_max: v.sets_max, reps_min: v.reps_min, reps_max: v.reps_max,
    rest_min_seconds: v.rest_min_seconds, rest_max_seconds: v.rest_max_seconds, tempo: v.tempo.trim() || null, source: 'set by trainer',
  }, { onConflict: 'exercise_id,goal_id' })
  if (error) fail(error.message)
}

export async function deleteGoalPrescription(exerciseId: string, goalId: string): Promise<void> {
  const { error } = await supabase.from('exercise_goal_prescriptions').delete().eq('exercise_id', exerciseId).eq('goal_id', goalId)
  if (error) fail(error.message)
}

export function muscleMapOf(lib: Exercise[]): Record<string, ExMuscles> {
  const out: Record<string, ExMuscles> = {}
  for (const e of lib) out[e.id] = { primary: e.primary_muscle ?? null, secondary: e.secondary ?? [] }
  return out
}

/* ---------- Templates (trainer) ---------- */
export interface TemplateEx { exercise_id: string; name: string; sets: number; reps: number; weight_kg: number; rest_sec: number; tempo: string; rpe: number | null; rir: number | null; notes: string }
export interface TemplateRow { id: string; name: string; description: string | null; exercises: TemplateEx[] }

export async function fetchTemplates(): Promise<TemplateRow[]> {
  const { data, error } = await supabase.from('workout_templates').select('id,name,description,exercises').order('created_at', { ascending: false })
  if (error) fail(error.message)
  return (data ?? []) as TemplateRow[]
}
export async function saveTemplate(staff: Profile, name: string, description: string, exercises: TemplateEx[]): Promise<void> {
  const { error } = await supabase.from('workout_templates').insert({ gym_id: staff.gym_id, created_by: staff.id, name: name.trim().slice(0, 120), description: description.trim() || null, exercises })
  if (error) fail(error.message)
}
export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('workout_templates').delete().eq('id', id)
  if (error) fail(error.message)
}

/* ---------- History used by the player ---------- */
export interface PrevSet { reps: number; weight_kg: number; rpe: number | null }
export interface ExHistory { date: string; sets: PrevSet[] }
export interface History { previous: Record<string, ExHistory>; baseline: Record<string, number> }

interface RawHist { exercise_id: string | null; session_id: string; set_no: number; reps: number | null; weight_kg: number | null; rpe: number | null; created_at: string }

/** Last session's sets and best estimated one-rep max for each exercise, so the player can show "last time" and detect records. */
export async function fetchHistory(userId: string, exerciseIds: string[]): Promise<History> {
  const out: History = { previous: {}, baseline: {} }
  if (!exerciseIds.length) return out
  const { data, error } = await supabase.from('workout_set_logs')
    .select('exercise_id,session_id,set_no,reps,weight_kg,rpe,created_at')
    .eq('user_id', userId).in('exercise_id', exerciseIds).order('created_at', { ascending: false }).limit(2000)
  if (error) fail(error.message)
  const rows = (data ?? []) as RawHist[]
  const lastSession = new Map<string, string>()
  for (const r of rows) {
    if (!r.exercise_id) continue
    const best = e1rm(Number(r.weight_kg ?? 0), r.reps ?? 0)
    if (best > (out.baseline[r.exercise_id] ?? 0)) out.baseline[r.exercise_id] = best
    if (!lastSession.has(r.exercise_id)) lastSession.set(r.exercise_id, r.session_id)
  }
  for (const r of rows) {
    if (!r.exercise_id || lastSession.get(r.exercise_id) !== r.session_id) continue
    const h = out.previous[r.exercise_id] ?? { date: r.created_at, sets: [] }
    h.sets.push({ reps: r.reps ?? 0, weight_kg: Number(r.weight_kg ?? 0), rpe: r.rpe })
    out.previous[r.exercise_id] = h
  }
  for (const h of Object.values(out.previous)) h.sets.reverse() // rows came newest first; show set 1 first
  return out
}

/* ---------- Saving a finished workout (idempotent, works offline) ---------- */
export interface PlayedSet { key: string; exercise_id: string | null; exercise_name: string; set_no: number; reps: number; weight_kg: number; rpe: number | null; rest_sec: number | null; is_pr: boolean; done_at: string }
export interface SessionInput { clientKey: string; name: string; dayId: string | null; startedAt: string; endedAt: string; sets: PlayedSet[]; weightKg: number | null; notes?: string }
export interface SavedSession { id: string | null; minutes: number; calories: number; volume: number; queued: boolean }
type Owner = Pick<Profile, 'id' | 'gym_id'>

const QKEY = (uid: string) => `f4l_pending_sessions_${uid}`

function readQueue(uid: string): SessionInput[] {
  try { const v = localStorage.getItem(QKEY(uid)); return v ? (JSON.parse(v) as SessionInput[]) : [] } catch { return [] }
}
function writeQueue(uid: string, q: SessionInput[]): void {
  try { if (q.length) localStorage.setItem(QKEY(uid), JSON.stringify(q)); else localStorage.removeItem(QKEY(uid)) } catch { /* storage unavailable: nothing more we can do */ }
}
export const pendingCount = (uid: string): number => readQueue(uid).length

const isNetworkError = (e: unknown): boolean => {
  const msg = e instanceof Error ? e.message : String(e)
  return (typeof navigator !== 'undefined' && navigator.onLine === false) || /failed to fetch|networkerror|load failed|network request failed/i.test(msg)
}

function figures(s: SessionInput) {
  const minutes = Math.max(1, Math.round((new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 60000))
  const volume = totalVolume(s.sets.map((x) => ({ reps: x.reps, weight_kg: x.weight_kg })))
  return { minutes, volume, calories: estimateBurn('Strength', minutes, s.weightKg) }
}

/** Upserts on client keys, so retrying (double tap, offline retry) never creates duplicates. */
async function push(o: Owner, s: SessionInput): Promise<string> {
  const f = figures(s)
  const ses = await supabase.from('workout_sessions').upsert({
    user_id: o.id, gym_id: o.gym_id, client_key: s.clientKey, day_id: s.dayId, name: s.name.slice(0, 120), category: 'Strength',
    started_at: s.startedAt, ended_at: s.endedAt, duration_min: Math.min(1000, f.minutes), calories: Math.min(10000, f.calories),
    total_volume_kg: f.volume, status: 'completed', notes: s.notes ?? null,
  }, { onConflict: 'user_id,client_key' }).select('id').single()
  if (ses.error || !ses.data) fail(ses.error?.message ?? 'Could not save workout')
  const id = (ses.data as { id: string }).id
  if (s.sets.length) {
    const rows = s.sets.map((x) => ({
      client_key: x.key, session_id: id, user_id: o.id, gym_id: o.gym_id, exercise_id: x.exercise_id, exercise_name: x.exercise_name,
      set_no: Math.min(50, x.set_no), reps: x.reps, weight_kg: x.weight_kg || null, rpe: x.rpe, rest_sec: x.rest_sec, is_pr: x.is_pr,
      e1rm_kg: e1rm(x.weight_kg, x.reps) || null, created_at: x.done_at,
    }))
    const r = await supabase.from('workout_set_logs').upsert(rows, { onConflict: 'user_id,client_key' })
    if (r.error) fail(r.error.message)
  }
  const h = await supabase.from('health_data').upsert(
    { user_id: o.id, gym_id: o.gym_id, metric_type: 'calories_burned', value: f.calories, unit: 'kcal', source: 'workout', external_record_id: id, recorded_at: s.endedAt },
    { onConflict: 'user_id,source,external_record_id' },
  )
  if (h.error) fail(h.error.message)
  return id
}

export async function saveSession(o: Owner, s: SessionInput): Promise<SavedSession> {
  const f = figures(s)
  try {
    const id = await push(o, s)
    return { id, ...f, queued: false }
  } catch (e) {
    if (!isNetworkError(e)) throw e
    const q = readQueue(o.id).filter((x) => x.clientKey !== s.clientKey)
    writeQueue(o.id, [...q, s])
    return { id: null, ...f, queued: true }
  }
}

/** Sends any workouts that were finished while offline. Returns how many were sent. */
export async function flushPending(o: Owner): Promise<number> {
  const q = readQueue(o.id)
  if (!q.length) return 0
  const left: SessionInput[] = []
  let sent = 0
  for (const s of q) {
    try { await push(o, s); sent++ } catch (e) { if (isNetworkError(e)) left.push(s); else { console.error('Dropping unsendable workout', e); } }
  }
  writeQueue(o.id, left)
  return sent
}

/* ---------- Training data for recovery and analytics ---------- */
export interface SetRow extends SetRowLite { exercise_name: string; is_pr: boolean }

export async function fetchSetRows(userId: string, days: number): Promise<SetRow[]> {
  const since = new Date(Date.now() - days * 864e5).toISOString()
  const out: SetRow[] = []
  for (let page = 0; page < 6; page++) {
    const { data, error } = await supabase.from('workout_set_logs')
      .select('session_id,exercise_id,exercise_name,reps,weight_kg,is_pr,created_at')
      .eq('user_id', userId).gte('created_at', since).order('created_at', { ascending: false }).range(page * 1000, page * 1000 + 999)
    if (error) fail(error.message)
    const rows = (data ?? []) as { session_id: string; exercise_id: string | null; exercise_name: string; reps: number | null; weight_kg: number | null; is_pr: boolean; created_at: string }[]
    out.push(...rows.map((r) => ({ ...r, weight_kg: r.weight_kg == null ? null : Number(r.weight_kg) })))
    if (rows.length < 1000) break
  }
  return out
}

export interface SessionSummaryRow { id: string; name: string; started_at: string; duration_min: number | null; total_volume_kg: number | null; calories: number | null }
export async function fetchSessionRange(userId: string, days: number): Promise<SessionSummaryRow[]> {
  const since = new Date(Date.now() - days * 864e5).toISOString()
  const { data, error } = await supabase.from('workout_sessions')
    .select('id,name,started_at,duration_min,total_volume_kg,calories').eq('user_id', userId).gte('started_at', since).order('started_at', { ascending: false }).limit(1000)
  if (error) fail(error.message)
  return ((data ?? []) as SessionSummaryRow[]).map((r) => ({ ...r, total_volume_kg: r.total_volume_kg == null ? null : Number(r.total_volume_kg) }))
}
