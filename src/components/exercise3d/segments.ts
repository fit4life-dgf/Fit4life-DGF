import { BODY_COLORS } from '../muscle3d/muscleMap'

export type SegmentKey = 'torso' | 'shoulder' | 'upperArm' | 'foreArm' | 'thigh' | 'hip' | 'shin'

/** Which part of the demo figure stands in for each muscle. The figure is a movement guide, not an anatomy model. */
export const SEGMENT_OF: Record<string, SegmentKey> = {
  chest: 'torso', lats: 'torso', mid_back: 'torso', traps: 'torso', abs: 'torso', obliques: 'torso', lower_back: 'torso', serratus: 'torso',
  front_delts: 'shoulder', side_delts: 'shoulder', rear_delts: 'shoulder',
  biceps: 'upperArm', triceps: 'upperArm', forearms: 'foreArm',
  quads: 'thigh', hamstrings: 'thigh', adductors: 'thigh', glutes: 'hip', calves: 'shin',
}

const RANK = { none: 0, stabilizer: 1, secondary: 2, primary: 3 } as const
type Role = keyof typeof RANK

/** Colour for each body segment: the strongest role of any muscle that maps onto it. */
export function segmentColors(primary: string[], secondary: string[], stabilizers: string[]): Record<SegmentKey, string> {
  const role: Record<SegmentKey, Role> = { torso: 'none', shoulder: 'none', upperArm: 'none', foreArm: 'none', thigh: 'none', hip: 'none', shin: 'none' }
  const mark = (ids: string[], r: Exclude<Role, 'none'>) => {
    for (const id of ids) {
      const seg = SEGMENT_OF[id]
      if (seg && RANK[r] > RANK[role[seg]]) role[seg] = r
    }
  }
  mark(stabilizers, 'stabilizer'); mark(secondary, 'secondary'); mark(primary, 'primary')
  const out = {} as Record<SegmentKey, string>
  for (const k of Object.keys(role) as SegmentKey[]) out[k] = role[k] === 'none' ? BODY_COLORS.inactive : BODY_COLORS[role[k]]
  return out
}
