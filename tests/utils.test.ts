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

if (fails) { console.error(fails + ' test(s) failed'); process.exit(1) }
