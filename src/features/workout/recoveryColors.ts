import { BODY_COLORS, MUSCLE_IDS } from '../../components/muscle3d/muscleMap'
import type { Recovery } from '../../utils/workoutMath'

/** Per-muscle colours for the 3D body from a recovery map. `only` limits colouring to muscles in that set. */
export function recoveryColors(r: Record<string, Recovery>, only?: Set<string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const id of MUSCLE_IDS) {
    if (only && !only.has(id)) continue
    const x = r[id]
    if (x) out[id] = BODY_COLORS[x.status]
  }
  return out
}

export const STATUS_LABEL: Record<Recovery['status'], string> = { rested: 'Rested', fresh: 'Fresh', recovering: 'Recovering', fatigued: 'Fatigued' }
