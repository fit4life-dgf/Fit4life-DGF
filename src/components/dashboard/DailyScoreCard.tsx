import type { ScoreResult } from '../../types'
import { useCountUp } from '../../hooks/useCountUp'
import { Card } from '../ui/Card'
import { ProgressRing } from '../ui/ProgressRing'

const BAR: Record<string, string> = { sleep: 'bg-sleep', activity: 'bg-steps', hydration: 'bg-water', recovery: 'bg-recovery' }

export function DailyScoreCard({ score }: { score: ScoreResult }) {
  const shown = useCountUp(score.daily ?? 0)
  return (
    <Card className="flex flex-col items-center gap-4">
      <ProgressRing value={score.daily ?? 0} size={168} stroke={13} color="recovery" label={score.daily == null ? 'Daily score unavailable' : `Daily score ${score.daily} out of 100, ${score.label}`}>
        <span className="tabular text-5xl font-extrabold leading-none">{score.daily == null ? '—' : Math.round(shown)}</span>
        <span className="mt-1 text-xs font-semibold text-ink2">{score.label ?? 'No data yet'}</span>
      </ProgressRing>
      <p className="text-center text-xs text-ink2">
        {score.daily == null ? 'Log sleep, steps or water to see your daily score.' : 'Sleep, activity, hydration and recovery combined.'}
      </p>
      <ul className="grid w-full gap-2">
        {score.parts.map((p) => (
          <li key={p.key} className="flex items-center gap-3 text-xs">
            <span className="w-20 font-semibold text-ink2">{p.label}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-card2"><div className={`h-full rounded-full ${BAR[p.key]} transition-[width] duration-700`} style={{ width: `${p.value ?? 0}%` }} /></div>
            <span className="tabular w-8 text-right font-bold">{p.value ?? '—'}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}
