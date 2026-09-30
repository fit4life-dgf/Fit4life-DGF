import { Sparkles } from 'lucide-react'
import type { CoachInsight } from '../../types'
import { TINT } from '../ui/colors'

const DOT = { good: 'bg-good', warn: 'bg-warn', neutral: 'bg-ink2' } as const

export function CoachCard({ insight }: { insight: CoachInsight }) {
  return (
    <section className={`rounded-card p-4 animate-rise ${TINT.ai}`} aria-label="AI coach recommendation">
      <div className="flex items-center gap-2 text-sm font-semibold text-ink/80"><Sparkles size={18} />AI Coach</div>
      <h3 className="mt-2 flex items-start gap-2 text-base font-extrabold text-ink"><span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${DOT[insight.tone]}`} />{insight.headline}</h3>
      <dl className="mt-2 grid gap-1 text-sm text-ink/80">
        <div><dt className="inline font-semibold">Intensity: </dt><dd className="inline">{insight.intensity}</dd></div>
        <div><dt className="inline font-semibold">Suggestion: </dt><dd className="inline">{insight.suggestion}</dd></div>
        {insight.hydration && <div><dt className="inline font-semibold">Hydration: </dt><dd className="inline">{insight.hydration}</dd></div>}
      </dl>
    </section>
  )
}
