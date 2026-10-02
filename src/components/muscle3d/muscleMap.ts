/** Muscle ids match the `fit.muscles` table. `side` says which view they are visible from. */
export type MuscleId =
  | 'chest' | 'front_delts' | 'side_delts' | 'rear_delts' | 'traps' | 'biceps' | 'triceps' | 'forearms' | 'abs' | 'obliques'
  | 'lats' | 'mid_back' | 'lower_back' | 'glutes' | 'quads' | 'hamstrings' | 'calves' | 'adductors' | 'serratus'

export interface MuscleMeta { id: MuscleId; name: string; group: string; side: 'front' | 'back' | 'both' }

export const MUSCLES: MuscleMeta[] = [
  { id: 'chest', name: 'Chest', group: 'Chest', side: 'front' },
  { id: 'front_delts', name: 'Front shoulders', group: 'Shoulders', side: 'front' },
  { id: 'side_delts', name: 'Side shoulders', group: 'Shoulders', side: 'both' },
  { id: 'rear_delts', name: 'Rear shoulders', group: 'Shoulders', side: 'back' },
  { id: 'traps', name: 'Trapezius', group: 'Back', side: 'back' },
  { id: 'biceps', name: 'Biceps', group: 'Arms', side: 'front' },
  { id: 'triceps', name: 'Triceps', group: 'Arms', side: 'back' },
  { id: 'forearms', name: 'Forearms', group: 'Arms', side: 'both' },
  { id: 'abs', name: 'Abs', group: 'Core', side: 'front' },
  { id: 'obliques', name: 'Obliques', group: 'Core', side: 'front' },
  { id: 'lats', name: 'Lats', group: 'Back', side: 'back' },
  { id: 'mid_back', name: 'Mid back', group: 'Back', side: 'back' },
  { id: 'lower_back', name: 'Lower back', group: 'Back', side: 'back' },
  { id: 'glutes', name: 'Glutes', group: 'Legs', side: 'back' },
  { id: 'quads', name: 'Quadriceps', group: 'Legs', side: 'front' },
  { id: 'hamstrings', name: 'Hamstrings', group: 'Legs', side: 'back' },
  { id: 'calves', name: 'Calves', group: 'Legs', side: 'both' },
  { id: 'adductors', name: 'Adductors', group: 'Legs', side: 'front' },
  { id: 'serratus', name: 'Serratus anterior', group: 'Core', side: 'front' },
]

export const MUSCLE_IDS: string[] = MUSCLES.map((m) => m.id)
const BY_ID = new Map<string, MuscleMeta>(MUSCLES.map((m) => [m.id, m]))
export const muscleName = (id: string | null | undefined): string => (id ? BY_ID.get(id)?.name ?? id : '')
export const isMuscle = (id: string): boolean => BY_ID.has(id)

/** Colours used on the 3D body. `primary`/`secondary`/`stabilizer`/`inactive`/`inspected` are the exercise-role palette. */
export const BODY_COLORS = {
  base: '#9aa3b2',
  idle: '#d98a86',
  hover: '#f2b1ac',
  selected: '#22c55e',
  primary: '#ff3434',
  secondary: '#ff8a00',
  stabilizer: '#ffd43b',
  inactive: '#6b7280',
  rested: '#94a3b8',
  fresh: '#34d399',
  recovering: '#fbbf24',
  fatigued: '#f87171',
} as const

export type Role = 'primary' | 'secondary' | 'stabilizer'

/** Colour for every muscle: red primary, orange secondary, yellow stabilizer, grey for the rest. */
export function roleColors(primary: string[], secondary: string[], stabilizers: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const id of MUSCLE_IDS) out[id] = BODY_COLORS.inactive
  for (const id of stabilizers) out[id] = BODY_COLORS.stabilizer
  for (const id of secondary) out[id] = BODY_COLORS.secondary
  for (const id of primary) out[id] = BODY_COLORS.primary
  return out
}
