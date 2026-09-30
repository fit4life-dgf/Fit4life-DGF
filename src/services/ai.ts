import type { CoachInsight, ScoreResult, TodayData } from '../types'
import { formatNumber } from '../utils/format'

/**
 * Rule-based coach insight built only from the member's own data.
 * A language-model coach (Claude / Gemini behind a server function, so no API key reaches the browser) replaces this in Phase 9.
 */
export function buildInsight(d: TodayData, s: ScoreResult): CoachInsight {
  const remaining = Math.max(0, d.goals.water_ml - d.waterMl)
  const hydration = d.waterMl === 0 && !d.hasAnyData
    ? null
    : remaining > 0 ? `Drink another ${formatNumber(Math.ceil(remaining / 50) * 50)} ml today.` : 'Hydration goal reached.'

  if (s.readiness == null) {
    return {
      headline: 'Log last night’s sleep to unlock your coaching insight.',
      intensity: 'Not enough data yet',
      suggestion: d.workout ? `Today’s plan: ${d.workout.dayName}.` : 'No workout assigned yet.',
      hydration,
      tone: 'neutral',
    }
  }
  if (s.readiness >= 80) {
    return {
      headline: 'Your recovery is strong today.',
      intensity: 'Moderate to high training intensity',
      suggestion: d.workout ? `Go for ${d.workout.dayName}.` : 'A good day for a harder session.',
      hydration,
      tone: 'good',
    }
  }
  if (s.readiness >= 60) {
    return {
      headline: 'Recovery is average today.',
      intensity: 'Moderate intensity',
      suggestion: d.workout ? `Do ${d.workout.dayName}, but keep a rep or two in reserve.` : 'Keep the session steady.',
      hydration,
      tone: 'neutral',
    }
  }
  return {
    headline: 'Your body needs recovery today.',
    intensity: 'Light activity only',
    suggestion: 'Walk, stretch or do mobility work. Aim for an earlier night.',
    hydration,
    tone: 'warn',
  }
}
