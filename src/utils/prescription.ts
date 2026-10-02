/**
 * Which sets / reps / rest / tempo to show for an exercise. Priority, field by field:
 *   1. the client / trainer assignment   (values on the client's own plan)
 *   2. the program prescription          (values a workout template or program specifies)
 *   3. the exercise's goal default       (recommended range for the chosen training goal)
 *   4. nothing                           (shown as "Not prescribed"; nothing is ever invented)
 */
export interface Range { min: number; max: number }
export type Source = 'assignment' | 'program' | 'goal_default' | 'none'

/** One layer of values. Anything missing or invalid is skipped, so a layer may specify only some fields. */
export interface Layer {
  sets?: Range | number | string | null
  reps?: Range | number | string | null
  restSeconds?: Range | number | string | null
  tempo?: string | null
}
export interface Field<T> { value: T | null; source: Source }
export interface Resolved { sets: Field<Range>; reps: Field<Range>; restSeconds: Field<Range>; tempo: Field<string> }

export function toRange(v: unknown, allowZero = false): Range | null {
  const ok = (n: number) => Number.isFinite(n) && (allowZero ? n >= 0 : n > 0)
  if (typeof v === 'number') return ok(v) ? { min: v, max: v } : null
  if (typeof v === 'string') {
    const m = v.trim().match(/^(\d+(?:\.\d+)?)\s*(?:[-–—]|to)?\s*(\d+(?:\.\d+)?)?(?:\s*(?:reps?|sec|s|x))?$/i)
    if (!m) return null
    const a = Number(m[1]), b = m[2] == null ? a : Number(m[2])
    return ok(a) && ok(b) && b >= a ? { min: a, max: b } : null
  }
  if (v && typeof v === 'object') {
    const r = v as Partial<Range>
    if (typeof r.min === 'number' && typeof r.max === 'number' && ok(r.min) && ok(r.max) && r.max >= r.min) return { min: r.min, max: r.max }
  }
  return null
}

const toTempo = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

export function resolvePrescription(input: { assignment?: Layer | null; program?: Layer | null; goalDefault?: Layer | null }): Resolved {
  const layers: [Source, Layer | null | undefined][] = [['assignment', input.assignment], ['program', input.program], ['goal_default', input.goalDefault]]
  const pick = <T,>(read: (l: Layer) => T | null): Field<T> => {
    for (const [source, layer] of layers) {
      if (!layer) continue
      const value = read(layer)
      if (value != null) return { value, source }
    }
    return { value: null, source: 'none' }
  }
  return {
    sets: pick((l) => toRange(l.sets)),
    reps: pick((l) => toRange(l.reps)),
    restSeconds: pick((l) => toRange(l.restSeconds, true)),
    tempo: pick((l) => toTempo(l.tempo)),
  }
}

export const NOT_PRESCRIBED = 'Not prescribed'
export const formatRange = (r: Range | null): string => (r ? (r.min === r.max ? String(r.min) : `${r.min}-${r.max}`) : NOT_PRESCRIBED)
export const formatRest = (r: Range | null): string => (r ? `${formatRange(r)} sec` : NOT_PRESCRIBED)

export const SOURCE_LABEL: Record<Source, string> = {
  assignment: 'From your trainer', program: 'From the program', goal_default: 'Goal default', none: NOT_PRESCRIBED,
}

/** Row shape of fit.exercise_goal_prescriptions. */
export interface GoalPrescriptionRow {
  exercise_id: string; goal_id: string
  sets_min: number; sets_max: number; reps_min: number; reps_max: number
  rest_min_seconds: number; rest_max_seconds: number; tempo: string | null
}
export function goalDefaultLayer(rows: GoalPrescriptionRow[] | undefined | null, goalId: string | null): Layer | null {
  const r = goalId ? (rows ?? []).find((x) => x.goal_id === goalId) : undefined
  if (!r) return null
  return {
    sets: { min: r.sets_min, max: r.sets_max }, reps: { min: r.reps_min, max: r.reps_max },
    restSeconds: { min: r.rest_min_seconds, max: r.rest_max_seconds }, tempo: r.tempo,
  }
}

/** A starting point for the trainer's form, taken from the middle of a goal default range (rest rounded to 15 s). */
export function suggestFromLayer(layer: Layer | null): { sets: number; reps: number; rest_sec: number; tempo: string } | null {
  if (!layer) return null
  const sets = toRange(layer.sets), reps = toRange(layer.reps), rest = toRange(layer.restSeconds, true)
  if (!sets || !reps || !rest) return null
  return {
    sets: Math.floor((sets.min + sets.max) / 2),
    reps: Math.floor((reps.min + reps.max) / 2),
    rest_sec: Math.round((rest.min + rest.max) / 2 / 15) * 15,
    tempo: toTempo(layer.tempo) ?? '',
  }
}

export interface GoalDefaultInput {
  sets_min: number; sets_max: number; reps_min: number; reps_max: number
  rest_min_seconds: number; rest_max_seconds: number; tempo: string
}
const TEMPO_RE = /^[0-9X]-[0-9X]-[0-9X]-[0-9X]$/i
/** Null when the values can be saved, otherwise a message for the trainer. */
export function validateGoalDefault(v: GoalDefaultInput): string | null {
  const whole = (n: number) => Number.isInteger(n)
  if (![v.sets_min, v.sets_max, v.reps_min, v.reps_max, v.rest_min_seconds, v.rest_max_seconds].every(whole)) return 'Use whole numbers.'
  if (v.sets_min < 1 || v.reps_min < 1) return 'Sets and reps must be at least 1.'
  if (v.rest_min_seconds < 0) return 'Rest cannot be negative.'
  if (v.sets_max < v.sets_min) return 'Maximum sets must be at least the minimum.'
  if (v.reps_max < v.reps_min) return 'Maximum reps must be at least the minimum.'
  if (v.rest_max_seconds < v.rest_min_seconds) return 'Maximum rest must be at least the minimum.'
  if (v.tempo.trim() !== '' && !TEMPO_RE.test(v.tempo.trim())) return 'Tempo needs four characters separated by dashes, like 3-1-1-0.'
  return null
}
