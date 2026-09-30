import type { Exercise } from '../types'
import type { NewPlanDay } from '../services/workouts'

interface TDay { name: string; focus: string; dow: number; items: [string, number, string, number][] }
export interface PlanTemplate { id: string; label: string; description: string; days: TDay[] }

export const PLAN_TEMPLATES: PlanTemplate[] = [
  { id: 'fb3', label: 'Full body, 3 days', description: 'Mon / Wed / Fri. Good for beginners.', days: [
    { name: 'Full body A', focus: 'Full body', dow: 1, items: [['Goblet Squat', 3, '10', 75], ['Push-up', 3, '10', 60], ['Seated Cable Row', 3, '12', 60], ['Plank', 3, '30s', 45]] },
    { name: 'Full body B', focus: 'Full body', dow: 3, items: [['Romanian Deadlift', 3, '10', 90], ['Incline Dumbbell Press', 3, '10', 75], ['Lat Pulldown', 3, '12', 60], ['Russian Twist', 3, '20', 45]] },
    { name: 'Full body C', focus: 'Full body', dow: 5, items: [['Walking Lunge', 3, '12', 60], ['Overhead Press', 3, '8', 90], ['Bent-over Row', 3, '10', 75], ['Hanging Knee Raise', 3, '10', 45]] },
  ] },
  { id: 'ul4', label: 'Upper / lower, 4 days', description: 'Mon / Tue / Thu / Fri. Intermediate.', days: [
    { name: 'Upper A', focus: 'Chest and back', dow: 1, items: [['Bench Press', 4, '8', 90], ['Bent-over Row', 4, '8', 90], ['Overhead Press', 3, '10', 75], ['Triceps Pushdown', 3, '12', 45]] },
    { name: 'Lower A', focus: 'Quads and glutes', dow: 2, items: [['Barbell Back Squat', 4, '8', 120], ['Hip Thrust', 3, '10', 90], ['Leg Press', 3, '12', 75], ['Plank', 3, '45s', 45]] },
    { name: 'Upper B', focus: 'Shoulders and arms', dow: 4, items: [['Incline Dumbbell Press', 4, '10', 75], ['Lat Pulldown', 4, '10', 75], ['Dumbbell Lateral Raise', 3, '15', 45], ['Barbell Curl', 3, '12', 45]] },
    { name: 'Lower B', focus: 'Hamstrings and core', dow: 5, items: [['Romanian Deadlift', 4, '8', 120], ['Walking Lunge', 3, '12', 75], ['Hanging Knee Raise', 3, '12', 45], ['Russian Twist', 3, '20', 45]] },
  ] },
  { id: 'fat', label: 'Fat loss circuit, 4 days', description: 'Strength plus conditioning. Mon / Tue / Thu / Sat.', days: [
    { name: 'Strength circuit', focus: 'Full body', dow: 1, items: [['Goblet Squat', 3, '15', 45], ['Push-up', 3, '12', 45], ['Seated Cable Row', 3, '15', 45], ['Kettlebell Swing', 3, '20', 45]] },
    { name: 'Cardio intervals', focus: 'Conditioning', dow: 2, items: [['Treadmill Run', 1, '20 min', 60], ['Rowing Machine', 1, '10 min', 60], ['Skipping Rope', 3, '2 min', 45]] },
    { name: 'Lower and core', focus: 'Legs', dow: 4, items: [['Walking Lunge', 3, '15', 45], ['Hip Thrust', 3, '12', 60], ['Plank', 3, '45s', 30], ['Burpee', 3, '10', 45]] },
    { name: 'Upper and cardio', focus: 'Upper body', dow: 6, items: [['Incline Dumbbell Press', 3, '12', 45], ['Lat Pulldown', 3, '12', 45], ['Face Pull', 3, '15', 30], ['Rowing Machine', 1, '15 min', 60]] },
  ] },
]

/** Resolves template exercise names against the gym's library. Names that are missing are reported so the trainer knows. */
export function buildPlan(t: PlanTemplate, library: Exercise[]): { days: NewPlanDay[]; missing: string[] } {
  const byName = new Map(library.map((e) => [e.name.toLowerCase(), e]))
  const missing: string[] = []
  const days = t.days.map((d) => ({
    name: d.name, focus: d.focus, day_of_week: d.dow,
    exercises: d.items.flatMap(([n, sets, reps, rest]) => {
      const ex = byName.get(n.toLowerCase())
      if (!ex) { missing.push(n); return [] }
      return [{ exercise_id: ex.id, sets, reps, rest_sec: rest }]
    }),
  }))
  return { days, missing }
}
