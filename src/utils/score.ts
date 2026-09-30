import type { GoalTargets, ScoreLabel, ScorePart, ScoreResult, SleepRecord, TodayData } from '../types'
import { clamp } from './format'

/** Sleep quality 0-100: the device score if we have one, otherwise duration against goal minus time awake. */
export function sleepScoreOf(sleep: SleepRecord | null, goalMin: number): number | null {
  if (!sleep) return null
  if (sleep.score != null) return sleep.score
  const durationPart = clamp((sleep.duration_min / goalMin) * 100, 0, 100)
  const awakePenalty = sleep.awake_min != null && sleep.duration_min > 0
    ? clamp((sleep.awake_min / (sleep.duration_min + sleep.awake_min)) * 100, 0, 30)
    : 0
  return Math.round(clamp(durationPart - awakePenalty, 0, 100))
}

/** Lower resting heart rate = better recovery. 50 bpm = 100, 75 bpm = 50, 100 bpm = 0. */
export function restingHrScore(bpm: number | null): number | null {
  if (bpm == null) return null
  return Math.round(clamp(100 - (bpm - 50) * 2, 0, 100))
}

export function labelFor(score: number): ScoreLabel {
  if (score >= 85) return 'Excellent'
  if (score >= 70) return 'Good'
  if (score >= 55) return 'Average'
  return 'Needs Recovery'
}

function weighted(items: { v: number | null; w: number }[]): number | null {
  const have = items.filter((i): i is { v: number; w: number } => i.v != null)
  if (!have.length) return null
  const total = have.reduce((s, i) => s + i.w, 0)
  return Math.round(have.reduce((s, i) => s + i.v * i.w, 0) / total)
}

export function computeScore(d: TodayData, goals: GoalTargets): ScoreResult {
  const sleepScore = sleepScoreOf(d.sleep, goals.sleep_min)
  const rhr = restingHrScore(d.restingHr ?? d.sleep?.resting_hr ?? null)
  const activity = d.steps > 0 ? Math.round(clamp((d.steps / goals.steps) * 100, 0, 100)) : null
  const hydration = d.waterMl > 0 ? Math.round(clamp((d.waterMl / goals.water_ml) * 100, 0, 100)) : null

  const readiness = weighted([{ v: sleepScore, w: 0.6 }, { v: rhr, w: 0.4 }])
  const daily = weighted([
    { v: sleepScore, w: 0.3 },
    { v: activity, w: 0.3 },
    { v: hydration, w: 0.2 },
    { v: readiness, w: 0.2 },
  ])
  const parts: ScorePart[] = [
    { key: 'sleep', label: 'Sleep', value: sleepScore },
    { key: 'activity', label: 'Activity', value: activity },
    { key: 'hydration', label: 'Hydration', value: hydration },
    { key: 'recovery', label: 'Recovery', value: readiness },
  ]
  return { daily, label: daily == null ? null : labelFor(daily), readiness, sleepScore, parts }
}
