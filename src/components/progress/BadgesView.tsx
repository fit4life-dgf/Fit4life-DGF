import { useEffect } from 'react'
import { Award, Flame } from 'lucide-react'
import type { Profile } from '../../types'
import { activeDays, evaluateAchievements, fetchAchievements } from '../../services/progress'
import { useAsync } from '../../hooks/useAsync'
import { ACHIEVEMENTS, currentStreak } from '../../utils/achievements'
import { Card } from '../ui/Card'
import { ErrorBox, LoadingBlocks } from '../ui/StateViews'

export function BadgesView({ profile }: { profile: Profile }) {
  const earned = useAsync(async () => { await evaluateAchievements(profile); return fetchAchievements(profile.id) }, [profile.id])
  const days = useAsync(() => activeDays(profile.id, 60), [profile.id])
  useEffect(() => { void earned.reload() }, [])  // eslint-disable-line react-hooks/exhaustive-deps
  const streak = currentStreak(days.data ?? [])

  if (earned.loading) return <LoadingBlocks n={2} h="h-24" />
  if (earned.error) return <ErrorBox message={earned.error} onRetry={() => void earned.reload()} />
  return (
    <div className="grid gap-4">
      <Card className="flex items-center gap-3 bg-calories/50 border-0"><Flame className="text-ink" /><div><p className="tabular text-2xl font-extrabold text-ink">{streak} day{streak === 1 ? '' : 's'}</p><p className="text-xs text-ink/70">Current streak of days with something logged</p></div></Card>
      <ul className="grid grid-cols-2 gap-3">{ACHIEVEMENTS.map((a) => {
        const on = earned.data?.has(a.code) ?? false
        return <li key={a.code} className={`rounded-card p-4 ${on ? 'bg-recovery/60' : 'bg-card2'}`}><Award className={on ? 'text-ink' : 'text-muted'} /><p className="mt-2 text-sm font-bold">{a.title}</p><p className="text-xs text-ink2">{a.text}</p><p className="mt-1 text-[11px] font-semibold">{on ? 'Earned' : 'Locked'}</p></li>
      })}</ul>
    </div>
  )
}
