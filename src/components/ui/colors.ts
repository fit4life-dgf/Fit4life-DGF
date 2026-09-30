import type { MetricColor } from '../../types'

/** Static class maps so Tailwind can see every class name at build time. */
export const TINT: Record<MetricColor, string> = {
  steps: 'bg-steps', readiness: 'bg-readiness', sleep: 'bg-sleep', heart: 'bg-heart', water: 'bg-water',
  calories: 'bg-calories', workout: 'bg-workout', recovery: 'bg-recovery', ai: 'bg-ai', nutrition: 'bg-nutrition',
}
export const TINT_SOFT: Record<MetricColor, string> = {
  steps: 'bg-steps/30', readiness: 'bg-readiness/30', sleep: 'bg-sleep/30', heart: 'bg-heart/30', water: 'bg-water/30',
  calories: 'bg-calories/30', workout: 'bg-workout/30', recovery: 'bg-recovery/30', ai: 'bg-ai/30', nutrition: 'bg-nutrition/30',
}
export const STROKE: Record<MetricColor, string> = {
  steps: 'stroke-steps', readiness: 'stroke-readiness', sleep: 'stroke-sleep', heart: 'stroke-heart', water: 'stroke-water',
  calories: 'stroke-calories', workout: 'stroke-workout', recovery: 'stroke-recovery', ai: 'stroke-ai', nutrition: 'stroke-nutrition',
}
