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
if (fails) { console.error(fails + ' test(s) failed'); process.exit(1) }
console.log('all passed')
