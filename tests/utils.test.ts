import { computeScore, restingHrScore, labelFor, sleepScoreOf } from '../src/utils/score.ts'
import { dailyTargets, estimateBurn, ageFrom, bmi } from '../src/utils/energy.ts'
import { currentStreak } from '../src/utils/achievements.ts'
import { formatDuration, litres } from '../src/utils/format.ts'
import { buildPlan, PLAN_TEMPLATES } from '../src/utils/planTemplates.ts'

let fails = 0
function eq(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) { fails++; console.error('FAIL', name, 'got', got, 'want', want) } else console.log('ok  ', name)
}
const goals = { steps: 10000, water_ml: 3500, calories: 600, sleep_min: 480 }
eq('resting 50 -> 100', restingHrScore(50), 100)
eq('resting 75 -> 50', restingHrScore(75), 50)
eq('resting 100 -> 0', restingHrScore(100), 0)
eq('resting null', restingHrScore(null), null)
eq('label 85', labelFor(85), 'Excellent')
eq('label 70', labelFor(70), 'Good')
eq('label 55', labelFor(55), 'Average')
eq('label 54', labelFor(54), 'Needs Recovery')
const s = { id: 'x', sleep_date: '2026-01-01', duration_min: 480, deep_min: null, rem_min: null, light_min: null, awake_min: null, resting_hr: null, score: null, bedtime: null, wake_time: null }
eq('sleep score full', sleepScoreOf(s, 480), 100)
eq('sleep score half', sleepScoreOf({ ...s, duration_min: 240 }, 480), 50)
eq('sleep device score wins', sleepScoreOf({ ...s, score: 80 }, 480), 80)
const empty = { steps: 0, calories: 0, heartRate: null, restingHr: null, waterMl: 0, sleep: null, goals, workout: null, hasAnyData: false }
eq('empty daily null', computeScore(empty, goals).daily, null)
const full = computeScore({ ...empty, steps: 10000, waterMl: 3500, sleep: s, restingHr: 50, hasAnyData: true }, goals)
eq('perfect day = 100', full.daily, 100)
const only = computeScore({ ...empty, steps: 5000, hasAnyData: true }, goals)
eq('renormalised single part', only.daily, 50)
eq('duration', formatDuration(436), '7h 16m')
eq('litres', litres(3500), '3.5')
eq('age', ageFrom('2000-06-15', new Date('2026-06-14')), 25)
eq('bmi', bmi(70, 175), 22.9)
eq('burn strength 60min 70kg', estimateBurn('Strength', 60, 70), 350)
eq('burn default weight', estimateBurn('Running', 30, null), 315)
eq('targets need details', dailyTargets(null), null)
const t = dailyTargets({ dob: '2000-01-01', gender: 'male', height_cm: 175, weight_kg: 75, goal: 'maintain', activity_level: 'moderate' })
eq('targets sane', !!t && t.calories > 2200 && t.calories < 3000 && t.protein_g === 135, true)
const today = new Date('2026-03-10T12:00:00')
eq('streak 3', currentStreak(['2026-03-10', '2026-03-09', '2026-03-08', '2026-03-05'], today), 3)
eq('streak from yesterday', currentStreak(['2026-03-09', '2026-03-08'], today), 2)
eq('streak none', currentStreak(['2026-03-01'], today), 0)
const lib = ['Goblet Squat','Push-up','Seated Cable Row','Plank'].map((n, i) => ({ id: 'e' + i, name: n, muscle: 'x', equipment: 'x', level: 'x', cue: null }))
const built = buildPlan(PLAN_TEMPLATES[0], lib)
eq('template day count', built.days.length, 3)
eq('template resolves known', built.days[0].exercises.length, 4)
eq('template reports missing', built.missing.includes('Romanian Deadlift'), true)
console.log('all passed')

/* ---------- 3D workout system maths ---------- */
import { bucketVolume, toEvents, e1rm, findPrs, muscleLoad, recoveryMap, recoveryHours, readinessScore, suggestNext, totalVolume, firstNumber, estimateMinutes } from '../src/utils/workoutMath.ts'
eq('e1rm 100x5', e1rm(100, 5), 116.7)
eq('e1rm single', e1rm(120, 1), 120)
eq('e1rm zero weight', e1rm(0, 10), 0)
eq('volume', totalVolume([{ reps: 10, weight_kg: 50 }, { reps: 8, weight_kg: 60 }, { reps: null, weight_kg: 60 }]), 980)
eq('first number range', firstNumber('8-12'), 8)
eq('first number time', firstNumber('30s'), 30)
eq('first number none', firstNumber('max'), 10)
eq('minutes', estimateMinutes([{ sets: 3, rest_sec: 60 }, { sets: 3, rest_sec: 60 }]), 10)
eq('pr beats baseline', findPrs({ a: 100 }, [{ exerciseId: 'a', reps: 5, weightKg: 90 }, { exerciseId: 'a', reps: 5, weightKg: 100 }]), [1])
eq('no pr below baseline', findPrs({ a: 200 }, [{ exerciseId: 'a', reps: 5, weightKg: 100 }]), [])
eq('first lift is not a pr', findPrs({}, [{ exerciseId: 'a', reps: 5, weightKg: 100 }]), [])
eq('load weights', muscleLoad([{ exerciseId: 'x' }, { exerciseId: 'x' }, { exerciseId: null }], { x: { primary: 'chest', secondary: ['triceps'] } }), { chest: 2, triceps: 1 })
eq('recovery hours small', recoveryHours('biceps', 3), 36)
eq('recovery hours big heavy', recoveryHours('quads', 20), 72)
{
  const now = new Date('2026-03-10T12:00:00Z')
  const ev = [{ at: new Date('2026-03-10T06:00:00Z'), loads: { chest: 6, triceps: 3 } }, { at: new Date('2026-03-05T06:00:00Z'), loads: { quads: 8 } }]
  const r = recoveryMap(ev, ['chest', 'triceps', 'quads', 'abs'], now)
  eq('chest fatigued after 6h', r.chest.status, 'fatigued')
  eq('chest pct', r.chest.pct, 13)
  eq('triceps recovering pct', r.triceps.pct, 17)
  eq('quads fresh after 5 days', r.quads.status, 'fresh')
  eq('untouched is rested', r.abs.status, 'rested')
  eq('half a set is not enough', recoveryMap([{ at: now, loads: { abs: 0.5 } }], ['abs'], now).abs.status, 'rested')
}
eq('readiness full', readinessScore({ sleep: 100, restingHr: 100, muscles: 100 }), 100)
eq('readiness renormalised', readinessScore({ sleep: 80, restingHr: null, muscles: null }), 80)
eq('readiness none', readinessScore({ sleep: null, restingHr: null, muscles: null }), null)
eq('overload add', suggestNext([{ reps: 10, weight_kg: 50, rpe: 7 }, { reps: 10, weight_kg: 50, rpe: 8 }], 10)?.weight_kg, 52.5)
eq('overload hold when hard', suggestNext([{ reps: 10, weight_kg: 50, rpe: 10 }], 10)?.weight_kg, 50)
eq('overload none', suggestNext([], 10), null)

{
  const map = { x: { primary: 'chest', secondary: ['triceps'] } }
  const rows = [
    { session_id: 's1', exercise_id: 'x', created_at: '2026-03-10T10:00:00Z', reps: 10, weight_kg: 50 },
    { session_id: 's1', exercise_id: 'x', created_at: '2026-03-10T10:05:00Z', reps: 10, weight_kg: 50 },
    { session_id: 's2', exercise_id: 'x', created_at: '2026-03-08T10:00:00Z', reps: 5, weight_kg: 60 },
  ]
  const ev = toEvents(rows, map).sort((a, b) => b.at.getTime() - a.at.getTime())
  eq('events per session', ev.length, 2)
  eq('event load', ev[0].loads, { chest: 2, triceps: 1 })
  const local = [
    { session_id: 'a', exercise_id: 'x', created_at: new Date('2026-03-10T12:00:00').toISOString(), reps: 10, weight_kg: 50 },
    { session_id: 'a', exercise_id: 'x', created_at: new Date('2026-03-09T12:00:00').toISOString(), reps: 5, weight_kg: 20 },
    { session_id: 'a', exercise_id: 'x', created_at: new Date('2025-01-01T12:00:00').toISOString(), reps: 5, weight_kg: 20 },
  ]
  const b7 = bucketVolume(local, 7, new Date('2026-03-10T18:00:00'))
  eq('7 daily buckets', b7.length, 7)
  eq('today bucket', b7[6], { date: '2026-03-10', value: 500 })
  eq('yesterday bucket', b7[5], { date: '2026-03-09', value: 100 })
  const b90 = bucketVolume(local, 90, new Date('2026-03-10T18:00:00'))
  eq('weekly buckets', b90.length, 13)
  eq('weekly total', b90.reduce((a, x) => a + x.value, 0), 600)
}

import { resolveMuscle, layerOf, normaliseMeshName } from '../src/components/muscle3d/meshMap.ts'
eq('mesh pec L', resolveMuscle('muscle_pectoralis_major_L'), 'chest')
eq('mesh pec Left caps', resolveMuscle('Pectoralis_Major_Left'), 'chest')
eq('mesh biceps .001', resolveMuscle('Biceps_Brachii_Right.001'), 'biceps')
eq('mesh biceps femoris', resolveMuscle('biceps_femoris_L'), 'hamstrings')
eq('mesh deltoid anterior', resolveMuscle('Deltoid_Anterior_L'), 'front_delts')
eq('mesh serratus', resolveMuscle('muscle_serratus_anterior_R'), 'serratus')
eq('mesh rectus abdominis', resolveMuscle('muscle_rectus_abdominis'), 'abs')
eq('mesh rectus femoris', resolveMuscle('Rectus_Femoris_L'), 'quads')
eq('mesh unknown', resolveMuscle('Cube'), null)
eq('mesh custom map', resolveMuscle('Chest_Plate', { chest: ['chest_plate'] }), 'chest')
eq('layer skin', layerOf('Skin_Body'), 'skin')
eq('layer skeleton', layerOf('Skeleton_Femur_L'), 'skeleton')
eq('layer muscle', layerOf('muscle_quadriceps_L'), 'muscle')
eq('layer other', layerOf('Armature'), 'other')
eq('normalise side', normaliseMeshName('L_Biceps'), { base: 'biceps', side: 'left' })

import { resolvePrescription, toRange, formatRange, formatRest, goalDefaultLayer, suggestFromLayer, validateGoalDefault } from '../src/utils/prescription.ts'
const GD = { sets: { min: 3, max: 4 }, reps: { min: 8, max: 12 }, restSeconds: { min: 90, max: 150 }, tempo: '3-1-1-0' }
const PR = { sets: 5, reps: '6-8', restSeconds: 120, tempo: '2-0-2-0' }
const AS = { sets: 4, reps: 10, restSeconds: 75, tempo: '3-1-1' }
{
  const a = resolvePrescription({ assignment: AS, program: PR, goalDefault: GD })
  eq('rx assignment wins', [a.sets, a.reps, a.restSeconds, a.tempo].map((f) => f.source), ['assignment', 'assignment', 'assignment', 'assignment'])
  eq('rx assignment values', [a.sets.value, a.reps.value, a.restSeconds.value, a.tempo.value], [{ min: 4, max: 4 }, { min: 10, max: 10 }, { min: 75, max: 75 }, '3-1-1'])
  const p = resolvePrescription({ program: PR, goalDefault: GD })
  eq('rx program beats default', [p.sets.source, p.reps.value, p.restSeconds.value, p.tempo.value], ['program', { min: 6, max: 8 }, { min: 120, max: 120 }, '2-0-2-0'])
  const g = resolvePrescription({ goalDefault: GD })
  eq('rx goal default', [g.sets.source, g.reps.value, g.restSeconds.value, g.tempo.source], ['goal_default', { min: 8, max: 12 }, { min: 90, max: 150 }, 'goal_default'])
  const n = resolvePrescription({})
  eq('rx none', [n.sets, n.reps, n.restSeconds, n.tempo], [{ value: null, source: 'none' }, { value: null, source: 'none' }, { value: null, source: 'none' }, { value: null, source: 'none' }])
  const nn = resolvePrescription({ assignment: null, program: undefined, goalDefault: null })
  eq('rx null layers', nn.sets.source, 'none')
  const mix = resolvePrescription({ assignment: { sets: 4 }, program: { reps: '8-10' }, goalDefault: GD })
  eq('rx per-field mix', [mix.sets.source, mix.reps.source, mix.restSeconds.source, mix.tempo.source], ['assignment', 'program', 'goal_default', 'goal_default'])
  const bad = resolvePrescription({ assignment: { sets: 0, reps: 'abc', restSeconds: -5, tempo: '  ' }, goalDefault: GD })
  eq('rx invalid assignment values fall through', [bad.sets.source, bad.reps.source, bad.restSeconds.source, bad.tempo.source], ['goal_default', 'goal_default', 'goal_default', 'goal_default'])
  const inv = resolvePrescription({ assignment: { reps: { min: 12, max: 8 } } })
  eq('rx min>max invalid', inv.reps.source, 'none')
  eq('rx zero rest is valid', resolvePrescription({ assignment: { restSeconds: 0 }, goalDefault: GD }).restSeconds, { value: { min: 0, max: 0 }, source: 'assignment' })
  eq('rx tempo trimmed', resolvePrescription({ program: { tempo: ' 2-0-1-0 ' } }).tempo.value, '2-0-1-0')
}
eq('range en dash', toRange('8\u201312'), { min: 8, max: 12 })
eq('range single', toRange('10'), { min: 10, max: 10 })
eq('range with unit', toRange('10 reps'), { min: 10, max: 10 })
eq('range garbage', toRange('AMRAP'), null)
eq('fmt range', formatRange({ min: 8, max: 12 }), '8-12')
eq('fmt same', formatRange({ min: 5, max: 5 }), '5')
eq('fmt null', formatRange(null), 'Not prescribed')
eq('fmt rest', formatRest({ min: 90, max: 150 }), '90-150 sec')
eq('fmt rest null', formatRest(null), 'Not prescribed')
eq('goal layer picks goal', goalDefaultLayer([{ exercise_id: 'e', goal_id: 'strength', sets_min: 3, sets_max: 5, reps_min: 3, reps_max: 6, rest_min_seconds: 180, rest_max_seconds: 300, tempo: null }], 'strength')?.reps, { min: 3, max: 6 })
eq('goal layer other goal', goalDefaultLayer([{ exercise_id: 'e', goal_id: 'strength', sets_min: 3, sets_max: 5, reps_min: 3, reps_max: 6, rest_min_seconds: 180, rest_max_seconds: 300, tempo: null }], 'endurance'), null)
eq('goal layer none', goalDefaultLayer(null, 'strength'), null)

eq('suggest hypertrophy compound', suggestFromLayer(GD), { sets: 3, reps: 10, rest_sec: 120, tempo: '3-1-1-0' })
eq('suggest endurance', suggestFromLayer({ sets: { min: 2, max: 3 }, reps: { min: 15, max: 25 }, restSeconds: { min: 30, max: 60 }, tempo: null }), { sets: 2, reps: 20, rest_sec: 45, tempo: '' })
eq('suggest strength', suggestFromLayer({ sets: { min: 3, max: 5 }, reps: { min: 3, max: 6 }, restSeconds: { min: 180, max: 300 } }), { sets: 4, reps: 4, rest_sec: 240, tempo: '' })
eq('suggest null layer', suggestFromLayer(null), null)
eq('suggest incomplete layer', suggestFromLayer({ sets: { min: 3, max: 4 } }), null)
const OKV = { sets_min: 3, sets_max: 4, reps_min: 8, reps_max: 12, rest_min_seconds: 60, rest_max_seconds: 90, tempo: '' }
eq('validate ok', validateGoalDefault(OKV), null)
eq('validate ok with tempo', validateGoalDefault({ ...OKV, tempo: '3-1-1-0' }), null)
eq('validate sets order', validateGoalDefault({ ...OKV, sets_max: 2 }), 'Maximum sets must be at least the minimum.')
eq('validate reps order', validateGoalDefault({ ...OKV, reps_max: 5 }), 'Maximum reps must be at least the minimum.')
eq('validate rest order', validateGoalDefault({ ...OKV, rest_max_seconds: 30 }), 'Maximum rest must be at least the minimum.')
eq('validate zero sets', validateGoalDefault({ ...OKV, sets_min: 0 }), 'Sets and reps must be at least 1.')
eq('validate negative rest', validateGoalDefault({ ...OKV, rest_min_seconds: -15 }), 'Rest cannot be negative.')
eq('validate fraction', validateGoalDefault({ ...OKV, reps_min: 8.5 }), 'Use whole numbers.')
eq('validate tempo', validateGoalDefault({ ...OKV, tempo: 'fast' }), 'Tempo needs four characters separated by dashes, like 3-1-1-0.')

if (fails) { console.error(fails + ' test(s) failed'); process.exit(1) }
