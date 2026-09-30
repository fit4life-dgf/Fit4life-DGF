import { HeartPulse } from 'lucide-react'
import type { ScoreResult, TodayData } from '../../types'
import { MetricCard } from './MetricCard'

export function RecoveryCard({ score, data }: { score: ScoreResult; data: TodayData }) {
  const rhr = data.restingHr ?? data.sleep?.resting_hr ?? null
  const state = score.readiness == null ? undefined : score.readiness >= 80 ? 'Fully recovered' : score.readiness >= 60 ? 'Partly recovered' : 'Still recovering'
  return (
    <MetricCard color="recovery" icon={<HeartPulse size={18} />} label="Recovery" value={score.readiness == null ? null : String(score.readiness)} unit="/100" sub={state ? `${state}${rhr ? ` · resting ${rhr} bpm` : ''}` : 'Needs sleep or resting heart rate'} progress={score.readiness ?? undefined} />
  )
}
