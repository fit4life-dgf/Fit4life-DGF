export interface AchievementDef { code: string; title: string; text: string }
export const ACHIEVEMENTS: AchievementDef[] = [
  { code: 'first_workout', title: 'First rep', text: 'Complete your first workout.' },
  { code: 'workouts_10', title: 'Ten strong', text: 'Complete 10 workouts.' },
  { code: 'steps_10k', title: '10K day', text: 'Reach 10,000 steps in a day.' },
  { code: 'water_goal', title: 'Well hydrated', text: 'Reach your daily water goal.' },
  { code: 'sleep_8h', title: 'Well rested', text: 'Sleep 8 hours or more.' },
  { code: 'streak_7', title: 'Seven-day streak', text: 'Log something 7 days in a row.' },
  { code: 'first_weigh_in', title: 'On the scale', text: 'Log your first weigh-in.' },
  { code: 'attend_12', title: 'Regular', text: 'Check in 12 times.' },
]

/** Longest run of consecutive calendar days ending today or yesterday. Input: YYYY-MM-DD strings. */
export function currentStreak(days: string[], today: Date = new Date()): number {
  const set = new Set(days)
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const cur = new Date(today)
  if (!set.has(iso(cur))) cur.setDate(cur.getDate() - 1)
  let n = 0
  while (set.has(iso(cur))) { n++; cur.setDate(cur.getDate() - 1) }
  return n
}
