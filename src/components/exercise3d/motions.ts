/**
 * Movement engine for the 3D exercise demo. Pure maths (no three.js), so it can be unit tested.
 *
 * The figure faces +x, y is up, and every limb is a rigid segment, so lengths never change while it moves.
 * A motion is two poses (start and peak) that the figure eases between. Angles are degrees measured
 * counter-clockwise from +x. Legs and torso are chained upward from the ankle, then the arm from the shoulder.
 * Two kinds of motion are solved differently: push-ups/planks (hands and toes stay planted, the body is one line).
 */
export type V2 = [number, number]

export const LEN = { foot: 0.17, shin: 0.43, thigh: 0.45, torso: 0.52, neck: 0.2, upperArm: 0.3, foreArm: 0.27 } as const
export const ANKLE_H = 0.09

export interface Pose { shin: number; thigh: number; torso: number; upperArm: number; foreArm: number; foot?: number }
export interface Joints {
  toe: V2; ankle: V2; knee: V2; hip: V2; shoulder: V2; head: V2; elbow: V2; wrist: V2
}
export type Anchor = 'ankle' | 'hip' | 'wrist'
export type Equip = 'barbell' | 'dumbbell' | 'none'

export interface Motion {
  key: string
  label: string
  kind: 'chain' | 'planted'
  /** chain motions: which joint stays fixed, and where */
  anchor?: Anchor
  anchorAt?: V2
  a: Pose
  b: Pose
  /** arm angles are relative to the torso (so the arms follow it when it leans) */
  armsRel?: boolean
  /** planted motions: shoulder height above the hands at the start and peak */
  shoulderY?: [number, number]
  /** planted motions: forearm on the ground (plank) instead of straight arms */
  forearm?: boolean
  bench?: boolean
  fixedBar?: boolean
  /** where the barbell/dumbbell sits */
  holdAt: 'wrist' | 'shoulder'
  /** one-line description of what the figure shows, for screen readers */
  describe: string
  /** seconds for one repetition at 1x */
  seconds: number
}

const rad = (d: number) => (d * Math.PI) / 180
const add = (p: V2, len: number, deg: number): V2 => [p[0] + len * Math.cos(rad(deg)), p[1] + len * Math.sin(rad(deg))]
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

const STAND: Pose = { shin: 90, thigh: 90, torso: 90, upperArm: -90, foreArm: -90 }

export const MOTIONS: Record<string, Motion> = {
  backSquat: {
    key: 'backSquat', label: 'Back squat', kind: 'chain', anchor: 'ankle', anchorAt: [0, ANKLE_H], holdAt: 'shoulder', seconds: 3.6, armsRel: true,
    a: { ...STAND, upperArm: -190, foreArm: -20 },
    b: { shin: 68, thigh: 168, torso: 62, upperArm: -190, foreArm: -20 },
    describe: 'Stands with the bar on the upper back, sits the hips back and down until the thighs are level, then stands up.',
  },
  frontSquat: {
    key: 'frontSquat', label: 'Front squat', kind: 'chain', anchor: 'ankle', anchorAt: [0, ANKLE_H], holdAt: 'wrist', seconds: 3.6, armsRel: true,
    a: { ...STAND, upperArm: -150, foreArm: 10 },
    b: { shin: 70, thigh: 165, torso: 74, upperArm: -150, foreArm: 10 },
    describe: 'Holds the weight at the chest, sits down with an upright torso until the thighs are level, then stands up.',
  },
  hinge: {
    key: 'hinge', label: 'Hip hinge', kind: 'chain', anchor: 'ankle', anchorAt: [0, ANKLE_H], holdAt: 'wrist', seconds: 3.8,
    a: { ...STAND },
    b: { shin: 84, thigh: 148, torso: 28, upperArm: -90, foreArm: -90 },
    describe: 'Pushes the hips back with a flat back and soft knees, lowers the weight along the legs, then stands tall.',
  },
  overheadPress: {
    key: 'overheadPress', label: 'Overhead press', kind: 'chain', anchor: 'ankle', anchorAt: [0, ANKLE_H], holdAt: 'wrist', seconds: 3.2,
    a: { ...STAND, upperArm: -75, foreArm: 95 },
    b: { ...STAND, upperArm: 88, foreArm: 90 },
    describe: 'Starts with the weight at the shoulders, presses straight overhead to lockout, then lowers back.',
  },
  curl: {
    key: 'curl', label: 'Biceps curl', kind: 'chain', anchor: 'ankle', anchorAt: [0, ANKLE_H], holdAt: 'wrist', seconds: 3,
    a: { ...STAND, upperArm: -90, foreArm: -90 },
    b: { ...STAND, upperArm: -88, foreArm: 62 },
    describe: 'Elbows stay at the sides while the forearms curl the weight up to the shoulders, then lower under control.',
  },
  frontRaise: {
    key: 'frontRaise', label: 'Front raise', kind: 'chain', anchor: 'ankle', anchorAt: [0, ANKLE_H], holdAt: 'wrist', seconds: 3,
    a: { ...STAND, upperArm: -90, foreArm: -90 },
    b: { ...STAND, upperArm: 4, foreArm: 4 },
    describe: 'Raises the straight arms in front to shoulder height, then lowers them slowly.',
  },
  pushdown: {
    key: 'pushdown', label: 'Triceps pushdown', kind: 'chain', anchor: 'ankle', anchorAt: [0, ANKLE_H], holdAt: 'wrist', seconds: 2.8,
    a: { ...STAND, upperArm: -92, foreArm: 12 },
    b: { ...STAND, upperArm: -92, foreArm: -90 },
    describe: 'Elbows stay pinned at the sides while the forearms press down until the arms are straight, then return.',
  },
  row: {
    key: 'row', label: 'Bent-over row', kind: 'chain', anchor: 'ankle', anchorAt: [0, ANKLE_H], holdAt: 'wrist', seconds: 3.2,
    a: { shin: 82, thigh: 140, torso: 25, upperArm: -90, foreArm: -90 },
    b: { shin: 82, thigh: 140, torso: 25, upperArm: -155, foreArm: -90 },
    describe: 'Hinged forward with a flat back, pulls the weight toward the lower ribs by driving the elbows back, then lowers.',
  },
  benchPress: {
    key: 'benchPress', label: 'Bench press', kind: 'chain', anchor: 'hip', anchorAt: [0, 0.44], holdAt: 'wrist', bench: true, seconds: 3.4,
    a: { shin: 66, thigh: 185, torso: 180, upperArm: -25, foreArm: 100 },
    b: { shin: 66, thigh: 185, torso: 180, upperArm: 90, foreArm: 90 },
    describe: 'Lies on the bench with feet flat, lowers the weight to the chest, then presses it straight up over the shoulders.',
  },
  pullUp: {
    key: 'pullUp', label: 'Pull-up', kind: 'chain', anchor: 'wrist', anchorAt: [0, 2.45], holdAt: 'wrist', fixedBar: true, seconds: 3.6,
    a: { shin: 92, thigh: 92, torso: 90, upperArm: 90, foreArm: 90 },
    b: { shin: 100, thigh: 96, torso: 90, upperArm: -70, foreArm: 95 },
    describe: 'Hangs from the bar with straight arms, pulls the chest toward the bar until the chin is over it, then lowers.',
  },
  pushUp: {
    key: 'pushUp', label: 'Push-up', kind: 'planted', holdAt: 'wrist', shoulderY: [0.56, 0.17], seconds: 2.8,
    a: STAND, b: STAND,
    describe: 'Holds a straight line from head to heels, lowers the chest toward the floor by bending the elbows, then presses back up.',
  },
  plank: {
    key: 'plank', label: 'Plank', kind: 'planted', holdAt: 'wrist', shoulderY: [0.36, 0.37], forearm: true, seconds: 4,
    a: STAND, b: STAND,
    describe: 'Holds a straight line from head to heels on the forearms and toes, breathing steadily.',
  },
}

/** Exercise names (lower case) -> motion key. Only movements the figure shows correctly are listed. */
const BY_NAME: Record<string, string> = {
  'barbell back squat': 'backSquat', 'front squat': 'frontSquat', 'goblet squat': 'frontSquat',
  'deadlift': 'hinge', 'romanian deadlift': 'hinge', 'sumo deadlift': 'hinge', 'kettlebell swing': 'hinge',
  'overhead press': 'overheadPress', 'dumbbell shoulder press': 'overheadPress', 'arnold press': 'overheadPress',
  'barbell curl': 'curl', 'hammer curl': 'curl', 'front raise': 'frontRaise', 'triceps pushdown': 'pushdown',
  'bent-over row': 'row', 't-bar row': 'row',
  'bench press': 'benchPress', 'dumbbell bench press': 'benchPress', 'close-grip bench press': 'benchPress',
  'pull-up': 'pullUp', 'chin-up': 'pullUp', 'push-up': 'pushUp', 'plank': 'plank',
}

export function motionFor(name: string | null | undefined): Motion | null {
  const key = BY_NAME[(name ?? '').trim().toLowerCase()]
  return key ? MOTIONS[key] : null
}
export const SUPPORTED_EXERCISES = Object.keys(BY_NAME)

export function equipFor(equipment: string | null | undefined): Equip {
  const e = (equipment ?? '').toLowerCase()
  if (e.includes('barbell') || e.includes('ez')) return 'barbell'
  if (e.includes('dumbbell') || e.includes('kettlebell')) return 'dumbbell'
  return 'none'
}

/** 0 at the start pose, 1 at the peak, smooth in and out. `t` is the repetition cycle in [0, 1). */
export const ease = (t: number) => 0.5 - 0.5 * Math.cos(2 * Math.PI * t)

function mixPose(a: Pose, b: Pose, p: number): Pose {
  return { shin: lerp(a.shin, b.shin, p), thigh: lerp(a.thigh, b.thigh, p), torso: lerp(a.torso, b.torso, p), upperArm: lerp(a.upperArm, b.upperArm, p), foreArm: lerp(a.foreArm, b.foreArm, p), foot: lerp(a.foot ?? 0, b.foot ?? 0, p) }
}

function planted(m: Motion, p: number): Joints {
  const sy = lerp(m.shoulderY![0], m.shoulderY![1], p)
  const wrist: V2 = [0, 0.04]
  let shoulder: V2
  let elbow: V2
  if (m.forearm) {
    // forearm lies on the ground, upper arm vertical
    const wristF: V2 = [LEN.foreArm, 0.04]
    elbow = [0, 0.04]
    shoulder = [0, 0.04 + LEN.upperArm]
    void sy
    return finishPlanted(shoulder, elbow, wristF, 0.04 + LEN.upperArm)
  }
  // straight-arm / bent-arm push-up: hands planted, shoulders directly above them
  shoulder = [0, sy]
  const d = Math.min(Math.hypot(shoulder[0] - wrist[0], shoulder[1] - wrist[1]), LEN.foreArm + LEN.upperArm - 1e-6)
  // two-bone IK, elbow bends backward (toward the feet, -x)
  const a = (LEN.foreArm ** 2 - LEN.upperArm ** 2 + d ** 2) / (2 * d)
  const h = Math.sqrt(Math.max(0, LEN.foreArm ** 2 - a ** 2))
  const ux = (shoulder[0] - wrist[0]) / d
  const uy = (shoulder[1] - wrist[1]) / d
  const mid: V2 = [wrist[0] + a * ux, wrist[1] + a * uy]
  elbow = [mid[0] + h * uy * -1, mid[1] + h * ux]
  // pick the solution that puts the elbow behind the line (smaller x)
  const alt: V2 = [mid[0] - h * uy * -1, mid[1] - h * ux]
  if (alt[0] < elbow[0]) elbow = alt
  return finishPlanted(shoulder, elbow, wrist, sy)
}

function finishPlanted(shoulder: V2, elbow: V2, wrist: V2, sy: number): Joints {
  // body is one straight line from shoulder down to the toes, toes on the ground
  const total = LEN.torso + LEN.thigh + LEN.shin
  const sinT = Math.max(-1, Math.min(1, (sy - ANKLE_H) / total))
  const th = Math.asin(sinT)
  const dir: V2 = [Math.cos(th), Math.sin(th)]
  const hip: V2 = [shoulder[0] - LEN.torso * dir[0], shoulder[1] - LEN.torso * dir[1]]
  const knee: V2 = [hip[0] - LEN.thigh * dir[0], hip[1] - LEN.thigh * dir[1]]
  const ankle: V2 = [knee[0] - LEN.shin * dir[0], knee[1] - LEN.shin * dir[1]]
  const toe: V2 = [ankle[0] + 0.1, 0]
  const head: V2 = [shoulder[0] + LEN.neck * dir[0], shoulder[1] + LEN.neck * dir[1]]
  return { toe, ankle, knee, hip, shoulder, head, elbow, wrist }
}

/** Joint positions for repetition cycle `t` (any real number; it wraps). */
export function solve(m: Motion, t: number): Joints {
  const p = ease(((t % 1) + 1) % 1)
  if (m.kind === 'planted') return planted(m, p)
  const pose = mixPose(m.a, m.b, p)
  const ua = m.armsRel ? pose.torso + pose.upperArm : pose.upperArm
  const fa = m.armsRel ? pose.torso + pose.foreArm : pose.foreArm
  const ankle: V2 = [0, 0]
  const knee = add(ankle, LEN.shin, pose.shin)
  const hip = add(knee, LEN.thigh, pose.thigh)
  const shoulder = add(hip, LEN.torso, pose.torso)
  const head = add(shoulder, LEN.neck, pose.torso)
  const elbow = add(shoulder, LEN.upperArm, ua)
  const wrist = add(elbow, LEN.foreArm, fa)
  const toe = add(ankle, LEN.foot, pose.foot ?? 0)
  const j: Joints = { toe, ankle, knee, hip, shoulder, head, elbow, wrist }
  const anchor = m.anchor ?? 'ankle'
  const at = m.anchorAt ?? [0, ANKLE_H]
  const dx = at[0] - j[anchor][0]
  const dy = at[1] - j[anchor][1]
  const out = {} as Joints
  for (const k of Object.keys(j) as (keyof Joints)[]) out[k] = [j[k][0] + dx, j[k][1] + dy]
  return out
}

export const dist = (a: V2, b: V2) => Math.hypot(a[0] - b[0], a[1] - b[1])
