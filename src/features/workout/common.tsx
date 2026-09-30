import { Dumbbell } from 'lucide-react'
import type { Exercise } from '../../types'
import { muscleName } from '../../components/muscle3d/muscleMap'

export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`

export const mmss = (sec: number): string => {
  const s = Math.max(0, Math.round(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** What a trainer sets for one exercise. */
export interface ExerciseConfig { sets: number; reps: number; weight_kg: number; rest_sec: number; tempo: string; rpe: number | null; rir: number | null; notes: string }
export const DEFAULT_CONFIG: ExerciseConfig = { sets: 3, reps: 10, weight_kg: 0, rest_sec: 60, tempo: '', rpe: null, rir: null, notes: '' }

export const configLine = (c: Pick<ExerciseConfig, 'sets' | 'reps' | 'weight_kg' | 'rest_sec'>): string =>
  `${c.sets} × ${c.reps}${c.weight_kg > 0 ? ` · ${c.weight_kg} kg` : ''} · rest ${c.rest_sec}s`

/** Thumbnail tile. Real demo images/videos can replace this later via exercises.thumbnail_url / video_url. */
export function ExThumb({ ex, size = 56 }: { ex: Exercise; size?: number }) {
  return (
    <span aria-hidden style={{ width: size, height: size }} className="flex shrink-0 flex-col items-center justify-center rounded-tile bg-workout/40 text-ink">
      <Dumbbell size={size * 0.38} />
      <span className="mt-0.5 max-w-full truncate px-1 text-[9px] font-bold uppercase tracking-wide">{ex.equipment}</span>
    </span>
  )
}

export const primaryName = (ex: Exercise): string => muscleName(ex.primary_muscle) || ex.muscle
