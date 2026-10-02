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
