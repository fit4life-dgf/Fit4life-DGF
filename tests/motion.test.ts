import { ANKLE_H, LEN, MOTIONS, SUPPORTED_EXERCISES, dist, equipFor, motionFor, solve } from '../src/components/exercise3d/motions.ts'
import { segmentColors } from '../src/components/exercise3d/segments.ts'

let bad = 0
function check(name: string, ok: boolean, extra: unknown = '') {
  if (!ok) { bad++; console.error('FAIL', name, extra) } else console.log('ok  ', name)
}
const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol

const STEPS = 48
for (const [key, m] of Object.entries(MOTIONS)) {
  let lengthsOk = true, groundOk = true, finite = true
  let minY = 9
  for (let i = 0; i <= STEPS; i++) {
    const j = solve(m, i / STEPS)
    for (const p of Object.values(j)) if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])) finite = false
    for (const p of Object.values(j)) minY = Math.min(minY, p[1])
    // limb segments keep their length (planted motions solve the arm with IK, so only check the legs and torso there)
    const pairs: [keyof typeof j, keyof typeof j, number][] = [['knee', 'hip', LEN.thigh], ['hip', 'shoulder', LEN.torso], ['elbow', 'wrist', LEN.foreArm], ['shoulder', 'elbow', LEN.upperArm]]
    if (m.kind === 'chain') pairs.push(['ankle', 'knee', LEN.shin])
    for (const [a, b, len] of pairs) if (!near(dist(j[a], j[b]), len, 1e-3)) lengthsOk = false
    if (m.kind === 'planted') {
      // the whole body is one line: shin + thigh + torso lengths hold, and the toes touch the floor
      if (!near(dist(j.ankle, j.knee), LEN.shin, 1e-3)) lengthsOk = false
      if (!near(j.toe[1], 0, 1e-6)) groundOk = false
    }
  }
  check(`${key}: every joint stays finite`, finite)
  check(`${key}: segment lengths stay constant`, lengthsOk)
  check(`${key}: nothing sinks through the floor`, minY > -0.02, minY)
  check(`${key}: toes on the floor when planted`, groundOk)
  const s0 = solve(m, 0), s1 = solve(m, 1)
  check(`${key}: repetition loops cleanly`, near(s0.wrist[0], s1.wrist[0]) && near(s0.wrist[1], s1.wrist[1]) && near(s0.hip[1], s1.hip[1]))
  check(`${key}: peak differs from start`, dist(solve(m, 0).wrist, solve(m, 0.5).wrist) > 0.05 || dist(solve(m, 0).hip, solve(m, 0.5).hip) > 0.05 || key === 'plank')
}

// anchors do not drift
const sq0 = solve(MOMOTION('backSquat'), 0), sq5 = solve(MOMOTION('backSquat'), 0.5)
function MOMOTION(k: string) { return MOTIONS[k] }
check('squat: ankle stays planted', near(sq0.ankle[0], sq5.ankle[0]) && near(sq0.ankle[1], ANKLE_H) && near(sq5.ankle[1], ANKLE_H))
check('squat: hips go down and back', sq5.hip[1] < sq0.hip[1] - 0.3 && sq5.hip[0] < sq0.hip[0] - 0.1)
check('squat: bottom is about thigh-parallel', Math.abs(sq5.hip[1] - sq5.knee[1]) < 0.15, [sq5.hip, sq5.knee])
const pr0 = solve(MOTIONS.overheadPress, 0), pr5 = solve(MOTIONS.overheadPress, 0.5)
check('overhead press: wrist rises above the head', pr5.wrist[1] > pr5.head[1] && pr0.wrist[1] < pr0.head[1])
const cu5 = solve(MOTIONS.curl, 0.5), cu0 = solve(MOTIONS.curl, 0)
check('curl: elbow stays put while the hand rises', dist(cu0.elbow, cu5.elbow) < 0.02 && cu5.wrist[1] > cu0.wrist[1] + 0.2)
const be0 = solve(MOTIONS.benchPress, 0), be5 = solve(MOTIONS.benchPress, 0.5)
check('bench press: hips stay on the bench', near(be0.hip[1], 0.44) && near(be5.hip[1], 0.44))
check('bench press: bar goes from chest to over the shoulders', be5.wrist[1] > be0.wrist[1] + 0.3 && near(be5.wrist[0], be5.shoulder[0], 0.05))
const pu0 = solve(MOTIONS.pushUp, 0), pu5 = solve(MOTIONS.pushUp, 0.5)
check('push-up: chest lowers and hands stay planted', pu5.shoulder[1] < pu0.shoulder[1] - 0.3 && near(pu0.wrist[1], pu5.wrist[1]) && near(pu0.wrist[0], pu5.wrist[0]))
const pl = solve(MOTIONS.pullUp, 0), pl5 = solve(MOTIONS.pullUp, 0.5)
check('pull-up: hands stay on the bar and the body rises', near(pl.wrist[1], pl5.wrist[1]) && pl5.shoulder[1] > pl.shoulder[1] + 0.3)
check('pull-up: feet hang clear of the floor', pl.ankle[1] > 0.3 && pl5.ankle[1] > 0.3)

// exercise -> motion
check('lookup: names are case-insensitive', motionFor('BENCH PRESS')?.key === 'benchPress')
check('lookup: front squat and goblet squat share a motion', motionFor('Goblet Squat')?.key === 'frontSquat')
check('lookup: unsupported exercise has no demo', motionFor('Cable Fly') === null && motionFor('Walking Lunge') === null && motionFor(null) === null)
check('lookup: every listed exercise has a motion', SUPPORTED_EXERCISES.every((n) => motionFor(n) != null))
check('equipment: barbell / dumbbell / none', equipFor('Barbell') === 'barbell' && equipFor('Dumbbell') === 'dumbbell' && equipFor('Bodyweight') === 'none' && equipFor(null) === 'none')

// muscle colours on the figure: strongest role wins
const c = segmentColors(['quads'], ['glutes', 'hamstrings'], ['abs', 'calves'])
check('colours: primary beats secondary on the thigh', c.thigh === '#ff3434', c.thigh)
check('colours: secondary and stabilizer', c.hip === '#ff8a00' && c.torso === '#ffd43b' && c.shin === '#ffd43b')
check('colours: uninvolved parts are grey', c.upperArm === '#6b7280' && c.foreArm === '#6b7280')

if (bad) { console.error(bad + ' motion test(s) failed'); process.exitCode = 1 } else console.log('motion tests passed')
