import { supabase } from './supabase'
import type { Exercise, PlanDay, PlanExercise, Profile, SessionRow, SetLogInput } from '../types'
import { estimateBurn } from '../utils/energy'
import { estimateMinutes } from '../utils/workoutMath'

export const WORKOUT_CATEGORIES = ['Walking', 'Running', 'Cycling', 'Strength', 'HIIT', 'Mobility', 'Yoga', 'Cardio'] as const

function fail(message: string): never { throw new Error(message) }

export async function fetchExercises(): Promise<Exercise[]> {
  const { data, error } = await supabase.from('exercises').select('id,name,muscle,equipment,level,cue').order('muscle').order('name')
  if (error) fail(error.message)
  return (data ?? []) as Exercise[]
}

interface RawEx { id: string; name: string; muscle: string; equipment: string; level: string; cue: string | null; primary_muscle: string | null; instructions: string[] | null; video_url: string | null; exercise_secondary_muscles: { muscle_id: string }[] | null }
interface RawPlanExercise { id: string; exercise_id: string; position: number; sets: number; reps: string; rest_sec: number; weight_kg: number | null; tempo: string | null; rpe: number | null; rir: number | null; notes: string | null; exercises: RawEx | null }
interface RawDay { id: string; name: string; focus: string; day_of_week: number; est_minutes: number | null; workout_exercises: RawPlanExercise[] | null }

/** Days of the member's active plan, with their exercises in order. */
export async function fetchPlanDays(userId: string): Promise<{ planName: string; days: PlanDay[] } | null> {
  const { data, error } = await supabase
    .from('workout_plans')
    .select('name,workout_days(id,name,focus,day_of_week,est_minutes,workout_exercises(id,exercise_id,position,sets,reps,rest_sec,weight_kg,tempo,rpe,rir,notes,exercises(id,name,muscle,equipment,level,cue,primary_muscle,instructions,video_url,exercise_secondary_muscles(muscle_id))))')
    .eq('user_id', userId).eq('active', true).order('created_at', { ascending: false }).limit(1)
  if (error) fail(error.message)
  const plan = (data ?? [])[0] as { name: string; workout_days: RawDay[] | null } | undefined
  if (!plan) return null
  const days: PlanDay[] = (plan.workout_days ?? [])
    .map((d) => ({
      id: d.id, name: d.name, focus: d.focus, day_of_week: d.day_of_week, est_minutes: d.est_minutes,
      exercises: (d.workout_exercises ?? [])
        .filter((e): e is RawPlanExercise & { exercises: RawEx } => e.exercises != null)
        .map((e): PlanExercise => ({
          id: e.id, exercise_id: e.exercise_id, position: e.position, sets: e.sets, reps: e.reps, rest_sec: e.rest_sec,
          weight_kg: e.weight_kg == null ? null : Number(e.weight_kg), tempo: e.tempo, rpe: e.rpe, rir: e.rir, notes: e.notes,
          exercise: {
            id: e.exercises.id, name: e.exercises.name, muscle: e.exercises.muscle, equipment: e.exercises.equipment, level: e.exercises.level, cue: e.exercises.cue,
            primary_muscle: e.exercises.primary_muscle, instructions: e.exercises.instructions ?? [], video_url: e.exercises.video_url,
            secondary: (e.exercises.exercise_secondary_muscles ?? []).map((x) => x.muscle_id),
          },
        }))
        .sort((a, b) => a.position - b.position),
    }))
    .sort((a, b) => a.day_of_week - b.day_of_week)
  return { planName: plan.name, days }
}

export async function fetchSessions(userId: string, days = 30): Promise<SessionRow[]> {
  const since = new Date(Date.now() - days * 864e5).toISOString()
  const { data, error } = await supabase.from('workout_sessions')
    .select('id,name,category,started_at,ended_at,duration_min,calories')
    .eq('user_id', userId).gte('started_at', since).order('started_at', { ascending: false })
  if (error) fail(error.message)
  return (data ?? []) as SessionRow[]
}

/** Most recent weight used for each exercise name, so the player can pre-fill sets. */
export async function lastWeights(userId: string, names: string[]): Promise<Record<string, number>> {
  if (!names.length) return {}
  const { data, error } = await supabase.from('workout_set_logs')
    .select('exercise_name,weight_kg,created_at').eq('user_id', userId).in('exercise_name', names)
    .not('weight_kg', 'is', null).order('created_at', { ascending: false }).limit(300)
  if (error) fail(error.message)
  const out: Record<string, number> = {}
  for (const r of (data ?? []) as { exercise_name: string; weight_kg: number }[]) if (!(r.exercise_name in out)) out[r.exercise_name] = Number(r.weight_kg)
  return out
}

export interface FinishInput {
  name: string
  category: string
  dayId: string | null
  startedAt: Date
  sets: SetLogInput[]
  weightKg: number | null
}

/** Saves the session, its sets, and a calories_burned health record (deduplicated by session id). Returns estimated calories. */
export async function saveWorkout(p: Profile, f: FinishInput): Promise<{ id: string; minutes: number; calories: number }> {
  const ended = new Date()
  const minutes = Math.max(1, Math.round((ended.getTime() - f.startedAt.getTime()) / 60000))
  const calories = estimateBurn(f.category, minutes, f.weightKg)
  const { data, error } = await supabase.from('workout_sessions').insert({
    user_id: p.id, gym_id: p.gym_id, day_id: f.dayId, name: f.name, category: f.category,
    started_at: f.startedAt.toISOString(), ended_at: ended.toISOString(), duration_min: minutes, calories,
  }).select('id').single()
  if (error || !data) fail(error?.message ?? 'Could not save workout')
  const id = (data as { id: string }).id
  if (f.sets.length) {
    const rows = f.sets.map((s) => ({ ...s, session_id: id, user_id: p.id, gym_id: p.gym_id }))
    const r = await supabase.from('workout_set_logs').insert(rows)
    if (r.error) fail(r.error.message)
  }
  const h = await supabase.from('health_data').upsert(
    { user_id: p.id, gym_id: p.gym_id, metric_type: 'calories_burned', value: calories, unit: 'kcal', source: 'workout', external_record_id: id, recorded_at: ended.toISOString() },
    { onConflict: 'user_id,source,external_record_id' },
  )
  if (h.error) fail(h.error.message)
  return { id, minutes, calories }
}

/** Trainer/admin: create a plan with days and exercises for a member. */
export interface NewPlanExercise { exercise_id: string; sets: number; reps: string; rest_sec: number; weight_kg?: number | null; tempo?: string | null; rpe?: number | null; rir?: number | null; notes?: string | null }
export interface NewPlanDay { name: string; focus: string; day_of_week: number; exercises: NewPlanExercise[] }

/**
 * The new plan is built while inactive and only switched on at the end, so a failure part-way never leaves the member
 * without a plan or with a half-built one: the unfinished plan is deleted and the previous plan stays active.
 */
export async function createPlan(staff: Profile, memberUserId: string, name: string, days: NewPlanDay[], description: string | null = null): Promise<void> {
  const { data: tr } = await supabase.from('trainers').select('id').eq('user_id', staff.id).maybeSingle()
  const plan = await supabase.from('workout_plans').insert({
    user_id: memberUserId, gym_id: staff.gym_id, trainer_id: (tr as { id: string } | null)?.id ?? null, name, description, active: false,
  }).select('id').single()
  if (plan.error || !plan.data) fail(plan.error?.message ?? 'Could not create plan')
  const planId = (plan.data as { id: string }).id
  try {
    for (const d of days) {
      const day = await supabase.from('workout_days').insert({ plan_id: planId, name: d.name, focus: d.focus, day_of_week: d.day_of_week, est_minutes: estimateMinutes(d.exercises.map((e) => ({ sets: e.sets, rest_sec: e.rest_sec }))) }).select('id').single()
      if (day.error || !day.data) fail(day.error?.message ?? 'Could not create day')
      const dayId = (day.data as { id: string }).id
      if (d.exercises.length) {
        const ex = await supabase.from('workout_exercises').insert(d.exercises.map((e, i) => ({
          day_id: dayId, exercise_id: e.exercise_id, position: i + 1, sets: e.sets, reps: e.reps, rest_sec: e.rest_sec,
          weight_kg: e.weight_kg ?? null, tempo: e.tempo || null, rpe: e.rpe ?? null, rir: e.rir ?? null, notes: e.notes || null,
        })))
        if (ex.error) fail(ex.error.message)
      }
    }
    const off = await supabase.from('workout_plans').update({ active: false }).eq('user_id', memberUserId).eq('active', true)
    if (off.error) fail(off.error.message)
    const on = await supabase.from('workout_plans').update({ active: true }).eq('id', planId)
    if (on.error) fail(on.error.message)
  } catch (e) {
    await supabase.from('workout_plans').delete().eq('id', planId)
    throw e
  }
  await supabase.from('notifications').insert({ user_id: memberUserId, gym_id: staff.gym_id, kind: 'plan', title: 'New workout plan', body: name })
}
