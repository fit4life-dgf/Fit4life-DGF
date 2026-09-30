import type { MuscleId } from './muscleMap'

/**
 * The procedural body is built from ellipsoids, each one a separately named mesh. Names follow the anatomical naming that a
 * downloaded .glb model should also use (see MODEL_NAMES below), so a real model can replace this one without other changes.
 */
export interface BodyPart {
  key: string
  name: string
  muscle: MuscleId | null
  position: [number, number, number]
  scale: [number, number, number]
  rotation: [number, number, number]
  /** [radius, cylinder length] for limb segments drawn as capsules; null for ellipsoids. */
  capsule: [number, number] | null
}

type Row = { name: string; muscle: MuscleId | null; pos: [number, number, number]; scale: [number, number, number]; mirror: boolean; tilt?: number; cap?: [number, number] }

const R: Row[] = [
  // non-selectable anatomy
  { name: 'head', muscle: null, pos: [0, 0.77, 0], scale: [0.105, 0.125, 0.11], mirror: false },
  { name: 'neck', muscle: null, pos: [0, 0.635, 0], scale: [0.05, 0.06, 0.05], mirror: false },
  { name: 'torso', muscle: null, pos: [0, 0.32, 0], scale: [0.175, 0.335, 0.095], mirror: false },
  { name: 'pelvis', muscle: null, pos: [0, -0.02, 0], scale: [0.165, 0.12, 0.095], mirror: false },
  { name: 'upper_arm', muscle: null, pos: [0.29, 0.4, 0], scale: [1, 1, 1], mirror: true, tilt: 0.19, cap: [0.046, 0.175] },
  { name: 'lower_arm', muscle: null, pos: [0.336, 0.125, 0], scale: [1, 1, 1], mirror: true, tilt: 0.127, cap: [0.035, 0.22] },
  { name: 'hand', muscle: null, pos: [0.362, -0.06, 0], scale: [0.036, 0.062, 0.026], mirror: true, tilt: 0.127 },
  { name: 'thigh', muscle: null, pos: [0.0925, -0.28, 0], scale: [1, 1, 1], mirror: true, cap: [0.076, 0.29] },
  { name: 'shin', muscle: null, pos: [0.0925, -0.67, 0], scale: [1, 1, 1], mirror: true, cap: [0.046, 0.245] },
  { name: 'foot', muscle: null, pos: [0.09, -0.875, 0.05], scale: [0.045, 0.022, 0.085], mirror: true },
  // shoulders
  { name: 'anterior_deltoid', muscle: 'front_delts', pos: [0.245, 0.55, 0.05], scale: [0.06, 0.065, 0.05], mirror: true },
  { name: 'lateral_deltoid', muscle: 'side_delts', pos: [0.285, 0.55, 0], scale: [0.048, 0.07, 0.058], mirror: true },
  { name: 'posterior_deltoid', muscle: 'rear_delts', pos: [0.245, 0.55, -0.05], scale: [0.06, 0.065, 0.05], mirror: true },
  // chest and core
  { name: 'pectoralis_major', muscle: 'chest', pos: [0.09, 0.47, 0.075], scale: [0.092, 0.078, 0.042], mirror: true },
  { name: 'rectus_abdominis_1', muscle: 'abs', pos: [0.035, 0.355, 0.092], scale: [0.033, 0.03, 0.022], mirror: true },
  { name: 'rectus_abdominis_2', muscle: 'abs', pos: [0.035, 0.29, 0.093], scale: [0.033, 0.03, 0.022], mirror: true },
  { name: 'rectus_abdominis_3', muscle: 'abs', pos: [0.035, 0.225, 0.092], scale: [0.033, 0.03, 0.022], mirror: true },
  { name: 'rectus_abdominis_4', muscle: 'abs', pos: [0.033, 0.16, 0.09], scale: [0.032, 0.028, 0.02], mirror: true },
  { name: 'external_oblique', muscle: 'obliques', pos: [0.128, 0.26, 0.06], scale: [0.04, 0.14, 0.05], mirror: true },
  // arms
  { name: 'biceps', muscle: 'biceps', pos: [0.292, 0.4, 0.034], scale: [0.045, 0.125, 0.036], mirror: true, tilt: 0.19 },
  { name: 'triceps', muscle: 'triceps', pos: [0.292, 0.4, -0.034], scale: [0.045, 0.125, 0.036], mirror: true, tilt: 0.19 },
  { name: 'forearm', muscle: 'forearms', pos: [0.336, 0.14, 0], scale: [0.04, 0.125, 0.04], mirror: true, tilt: 0.127 },
  // back
  { name: 'trapezius', muscle: 'traps', pos: [0.06, 0.58, -0.062], scale: [0.09, 0.065, 0.04], mirror: true },
  { name: 'latissimus', muscle: 'lats', pos: [0.125, 0.38, -0.082], scale: [0.09, 0.15, 0.04], mirror: true },
  { name: 'rhomboid', muscle: 'mid_back', pos: [0.055, 0.44, -0.095], scale: [0.065, 0.08, 0.03], mirror: true },
  { name: 'erector_spinae', muscle: 'lower_back', pos: [0.045, 0.2, -0.09], scale: [0.055, 0.085, 0.03], mirror: true },
  // legs
  { name: 'gluteus', muscle: 'glutes', pos: [0.075, -0.03, -0.088], scale: [0.086, 0.095, 0.06], mirror: true },
  { name: 'quadriceps', muscle: 'quads', pos: [0.09, -0.3, 0.05], scale: [0.078, 0.2, 0.07], mirror: true },
  { name: 'hamstrings', muscle: 'hamstrings', pos: [0.09, -0.3, -0.05], scale: [0.072, 0.19, 0.062], mirror: true },
  { name: 'adductor', muscle: 'adductors', pos: [0.045, -0.23, 0.005], scale: [0.038, 0.14, 0.05], mirror: true },
  { name: 'gastrocnemius', muscle: 'calves', pos: [0.09, -0.65, -0.03], scale: [0.05, 0.145, 0.05], mirror: true },
]

/** Builds the parts list. The female figure has narrower shoulders and wider hips; both are approximations, not anatomical models. */
export function buildParts(gender: 'male' | 'female'): BodyPart[] {
  const upper = gender === 'female' ? 0.92 : 1
  const lower = gender === 'female' ? 1.1 : 1
  const out: BodyPart[] = []
  for (const r of R) {
    const f = r.pos[1] > 0.12 ? upper : lower
    // x is the viewer's right when facing the figure, so +x is the figure's left side
    const variants: { label: string; sign: number }[] = r.mirror ? [{ label: 'right', sign: -1 }, { label: 'left', sign: 1 }] : [{ label: '', sign: 1 }]
    for (const v of variants) {
      const name = v.label ? `${r.name}_${v.label}` : r.name
      out.push({
        key: name,
        name,
        muscle: r.muscle,
        position: [r.mirror ? v.sign * r.pos[0] * f : r.pos[0], r.pos[1], r.pos[2]],
        scale: [r.scale[0] * (r.mirror && !r.cap ? f : 1), r.scale[1], r.scale[2]],
        rotation: [0, 0, (r.tilt ?? 0) * (r.mirror ? v.sign : 1)],
        capsule: r.cap ?? null,
      })
    }
  }
  return out
}

/** Names a downloaded .glb must give its meshes to be recoloured per muscle (each optionally suffixed _left / _right). */
export const MODEL_NAMES: Record<string, MuscleId> = {
  pectoralis_major: 'chest', anterior_deltoid: 'front_delts', lateral_deltoid: 'side_delts', posterior_deltoid: 'rear_delts',
  trapezius: 'traps', biceps: 'biceps', triceps: 'triceps', forearm: 'forearms', rectus_abdominis: 'abs', external_oblique: 'obliques',
  latissimus: 'lats', rhomboid: 'mid_back', erector_spinae: 'lower_back', gluteus: 'glutes', quadriceps: 'quads',
  hamstrings: 'hamstrings', adductor: 'adductors', gastrocnemius: 'calves',
}
