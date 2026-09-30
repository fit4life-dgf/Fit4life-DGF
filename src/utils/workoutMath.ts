/** Pure training maths: volume, estimated 1RM, personal records, muscle load, recovery estimates, readiness. No I/O here so it can be tested. */

export interface LoggedSet { reps: number | null; weight_kg: number | null }

/** Epley estimate of a one-rep max. Returns 0 when there is no load or no reps. */
export function e1rm(weightKg: number, reps: number): number {
  if (!(weightKg > 0) || !(reps > 0)) return 0
  if (reps === 1) return round1(weightKg)
  return round1(weightKg * (1 + reps / 30))
}
const round1 = (n: number): number => Math.round(n * 10) / 10

export const setVolume = (s: LoggedSet): number => (s.reps ?? 0) * (s.weight_kg ?? 0)
export const totalVolume = (sets: LoggedSet[]): number => Math.round(sets.reduce((a, s) => a + setVolume(s), 0))

/** First whole number in a rep prescription such as "10", "8-12" or "30s". Falls back to 10. */
export function firstNumber(text: string): number {
  const m = /\d+/.exec(text)
  return m ? Number(m[0]) : 10
}

export interface PrCandidate { exerciseId: string; reps: number; weightKg: number }

/**
 * Finds sessions' personal records. `baseline` is the best estimated 1RM per exercise from earlier sessions.
 * Only one set per exercise (its best) can be flagged, and only when a baseline exists, so a first-ever lift is not called a record.
 * Returns the indexes into `sets` that are records.
 */
export function findPrs(baseline: Record<string, number>, sets: PrCandidate[]): number[] {
  const best = new Map<string, { i: number; v: number }>()
  sets.forEach((s, i) => {
    const v = e1rm(s.weightKg, s.reps)
    const cur = best.get(s.exerciseId)
    if (v > 0 && (!cur || v > cur.v)) best.set(s.exerciseId, { i, v })
  })
  const out: number[] = []
  for (const [id, b] of best) if ((baseline[id] ?? 0) > 0 && b.v > (baseline[id] ?? 0)) out.push(b.i)
  return out.sort((a, b) => a - b)
}

/** Rough session length: 40 seconds of work per set plus the prescribed rest, rounded up to 5 minutes. */
export function estimateMinutes(items: { sets: number; rest_sec: number }[]): number {
  const sec = items.reduce((a, e) => a + e.sets * (40 + e.rest_sec), 0)
  return Math.max(5, Math.ceil(sec / 60 / 5) * 5)
}

/* ---------- Muscle load and recovery ---------- */
export interface ExMuscles { primary: string | null; secondary: string[] }

/** Weighted set count per muscle: 1 for a primary mover, 0.5 for a secondary mover. */
export function muscleLoad(sets: { exerciseId: string | null }[], map: Record<string, ExMuscles>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const s of sets) {
    const m = s.exerciseId ? map[s.exerciseId] : undefined
    if (!m) continue
    if (m.primary) out[m.primary] = (out[m.primary] ?? 0) + 1
    for (const id of m.secondary) out[id] = (out[id] ?? 0) + 0.5
  }
  return out
}

export type RecoveryStatus = 'rested' | 'fresh' | 'recovering' | 'fatigued'
export interface Recovery { pct: number; status: RecoveryStatus; hoursLeft: number; load: number; lastAt: string | null }

const SMALL = new Set(['biceps', 'triceps', 'forearms', 'calves', 'abs', 'obliques', 'front_delts', 'side_delts', 'rear_delts', 'adductors', 'traps'])
/** Planning estimate of hours a muscle needs before it is trained hard again. Not a medical measurement. */
export function recoveryHours(muscle: string, load: number): number {
  const base = SMALL.has(muscle) ? 36 : 48
  return base + (load >= 16 ? 24 : load >= 8 ? 12 : 0)
}

export interface TrainingEvent { at: Date; loads: Record<string, number> }

/**
 * For each muscle: when it was last trained meaningfully (load of at least 1 weighted set), how much work was done in the 24 hours
 * up to that point, and how far along the estimated recovery window it is now.
 */
export function recoveryMap(events: TrainingEvent[], muscles: string[], now: Date = new Date()): Record<string, Recovery> {
  const out: Record<string, Recovery> = {}
  for (const m of muscles) {
    const hits = events.filter((e) => (e.loads[m] ?? 0) >= 1).sort((a, b) => b.at.getTime() - a.at.getTime())
    const last = hits[0]
    if (!last || now.getTime() - last.at.getTime() > 14 * 864e5) { out[m] = { pct: 100, status: 'rested', hoursLeft: 0, load: 0, lastAt: last ? last.at.toISOString() : null }; continue }
    const windowStart = last.at.getTime() - 24 * 36e5
    const load = hits.filter((e) => e.at.getTime() >= windowStart).reduce((a, e) => a + (e.loads[m] ?? 0), 0)
    const need = recoveryHours(m, load)
    const since = Math.max(0, (now.getTime() - last.at.getTime()) / 36e5)
    const pct = Math.min(100, Math.round((since / need) * 100))
    const status: RecoveryStatus = pct >= 100 ? 'fresh' : pct >= 50 ? 'recovering' : 'fatigued'
    out[m] = { pct, status, hoursLeft: Math.max(0, Math.ceil(need - since)), load, lastAt: last.at.toISOString() }
  }
  return out
}

/** Readiness estimate from parts already scored 0-100. Missing parts are skipped and the rest re-weighted. Returns null with no data. */
export function readinessScore(p: { sleep: number | null; restingHr: number | null; muscles: number | null }): number | null {
  const parts: [number | null, number][] = [[p.sleep, 0.45], [p.restingHr, 0.2], [p.muscles, 0.35]]
  const have = parts.filter((x): x is [number, number] => x[0] != null)
  if (!have.length) return null
  const w = have.reduce((a, [, k]) => a + k, 0)
  return Math.round(have.reduce((a, [v, k]) => a + v * k, 0) / w)
}

/** Simple progressive-overload hint: if every set hit the target reps at RPE 8 or easier, add 2.5 kg next time. */
export function suggestNext(prev: { reps: number; weight_kg: number; rpe: number | null }[], targetReps: number): { weight_kg: number; note: string } | null {
  const work = prev.filter((s) => s.weight_kg > 0)
  if (!work.length) return null
  const top = Math.max(...work.map((s) => s.weight_kg))
  const atTop = work.filter((s) => s.weight_kg === top)
  const allHit = atTop.length > 0 && atTop.every((s) => s.reps >= targetReps)
  const easy = atTop.every((s) => s.rpe == null || s.rpe <= 8)
  if (allHit && easy) return { weight_kg: top + 2.5, note: `All sets at ${top} kg reached ${targetReps} reps. Try ${top + 2.5} kg.` }
  return { weight_kg: top, note: `Stay at ${top} kg until every set reaches ${targetReps} reps.` }
}

/* ---------- Grouping logged sets ---------- */
export interface SetRowLite { session_id: string; exercise_id: string | null; created_at: string; reps: number | null; weight_kg: number | null }

/** One training event per session: when it ended and how much load each muscle got. */
export function toEvents(rows: SetRowLite[], map: Record<string, ExMuscles>): TrainingEvent[] {
  const by = new Map<string, { at: number; sets: { exerciseId: string | null }[] }>()
  for (const r of rows) {
    const t = new Date(r.created_at).getTime()
    if (Number.isNaN(t)) continue
    const cur = by.get(r.session_id) ?? { at: 0, sets: [] }
    cur.at = Math.max(cur.at, t)
    cur.sets.push({ exerciseId: r.exercise_id })
    by.set(r.session_id, cur)
  }
  return [...by.values()].map((v) => ({ at: new Date(v.at), loads: muscleLoad(v.sets, map) }))
}

const pad = (n: number) => String(n).padStart(2, '0')
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** Training volume (kg) per day for ranges up to a month, per week beyond that. Each point is dated by the start of its bucket. */
export function bucketVolume(rows: SetRowLite[], days: number, now: Date = new Date()): { date: string; value: number }[] {
  const step = days <= 31 ? 1 : 7
  const start = new Date(now); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - (days - 1))
  const n = Math.ceil(days / step)
  const out = Array.from({ length: n }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i * step); return { date: dayKey(d), value: 0 } })
  for (const r of rows) {
    const t = new Date(r.created_at)
    if (Number.isNaN(t.getTime())) continue
    t.setHours(0, 0, 0, 0)
    const idx = Math.floor(Math.round((t.getTime() - start.getTime()) / 864e5) / step)
    if (idx >= 0 && idx < n) out[idx].value += setVolume(r)
  }
  return out.map((o) => ({ date: o.date, value: Math.round(o.value) }))
}
