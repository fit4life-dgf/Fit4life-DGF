import type { Exercise, PlanExercise } from '../../types'
import { findPrs, firstNumber, suggestNext, type PrCandidate } from '../../utils/workoutMath'
import type { History, PlayedSet } from '../../services/workoutSystem'
import { uid } from './common'

export interface PSet { reps: number; weight: number; rpe: number | null; done: boolean; doneAt: string | null; pr: boolean }
export interface PEx { key: string; exercise: Exercise; target: number; rest: number; tempo: string | null; notes: string | null; targetRpe: number | null; sets: PSet[] }
export interface Active { clientKey: string; dayId: string | null; name: string; startedAt: string; items: PEx[]; ex: number }

export interface DayLike { id: string | null; name: string; focus: string; est_minutes: number | null; exercises: PlanExercise[] }

/** A one-exercise day used when a client starts from the exercise library. */
export function singleExerciseDay(e: Exercise): DayLike {
  return { id: null, name: e.name, focus: e.muscle, est_minutes: 10, exercises: [{ id: uid(), exercise_id: e.id, position: 1, sets: 3, reps: '10', rest_sec: 60, exercise: e }] }
}

/** Sets up a workout to play. Empty weights are filled from last time (with an overload hint) so the client rarely has to type. */
export function buildActive(day: DayLike, history: History | null): Active {
  const items: PEx[] = day.exercises.map((p) => {
    const target = firstNumber(p.reps)
    const prev = history?.previous[p.exercise.id]
    const planned = p.weight_kg ?? 0
    const hint = prev ? suggestNext(prev.sets.map((s) => ({ reps: s.reps, weight_kg: s.weight_kg, rpe: s.rpe })), target) : null
    const weight = planned > 0 ? planned : hint?.weight_kg ?? 0
    return {
      key: uid(), exercise: p.exercise, target, rest: p.rest_sec, tempo: p.tempo ?? null, notes: p.notes ?? null, targetRpe: p.rpe ?? null,
      sets: Array.from({ length: Math.max(1, p.sets) }, () => ({ reps: target, weight, rpe: null, done: false, doneAt: null, pr: false })),
    }
  })
  return { clientKey: uid(), dayId: day.id, name: day.name, startedAt: new Date().toISOString(), items, ex: 0 }
}

/** Index of the first set not yet done, or -1 when the exercise is finished. */
export const pendingIndex = (it: PEx): number => it.sets.findIndex((s) => !s.done)
export const doneSets = (a: Active): number => a.items.reduce((n, it) => n + it.sets.filter((s) => s.done).length, 0)
export const totalSets = (a: Active): number => a.items.reduce((n, it) => n + it.sets.length, 0)

/** The exercise to work on after `from`: the same one while sets remain, then later ones, then any earlier skipped one. */
export function nextExercise(a: Active, from: number): number {
  const n = a.items.length
  for (let k = 0; k < n; k++) {
    const i = (from + k) % n
    if (pendingIndex(a.items[i]) !== -1) return i
  }
  return -1
}

/** Completed sets ready to save. Personal records are decided here from the best previous estimated 1RM per exercise. */
export function toPlayed(a: Active, baseline: Record<string, number>): PlayedSet[] {
  const out: PlayedSet[] = []
  const cands: PrCandidate[] = []
  a.items.forEach((it, i) => it.sets.forEach((s, j) => {
    if (!s.done) return
    out.push({
      key: `${a.clientKey}:${i}:${j + 1}`, exercise_id: it.exercise.id, exercise_name: it.exercise.name, set_no: j + 1,
      reps: s.reps, weight_kg: s.weight, rpe: s.rpe, rest_sec: it.rest, is_pr: false, done_at: s.doneAt ?? new Date().toISOString(),
    })
    cands.push({ exerciseId: it.exercise.id, reps: s.reps, weightKg: s.weight })
  }))
  for (const i of findPrs(baseline, cands)) out[i].is_pr = true
  return out
}

/* ---------- Keep an in-progress workout across reloads ---------- */
const AKEY = (uidv: string) => `f4l_active_workout_${uidv}`
export function loadActive(userId: string): Active | null {
  try {
    const v = localStorage.getItem(AKEY(userId))
    if (!v) return null
    const a = JSON.parse(v) as Active
    return a && Array.isArray(a.items) && a.items.length && typeof a.clientKey === 'string' ? a : null
  } catch { return null }
}
export function saveActive(userId: string, a: Active | null): void {
  try { if (a) localStorage.setItem(AKEY(userId), JSON.stringify(a)); else localStorage.removeItem(AKEY(userId)) } catch { /* the workout just will not survive a reload */ }
}
