import { Avatar, readShape } from '../components/profile/Avatar'
import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Bell, Droplets, Flame, Footprints, Heart, Moon, Play, Plus, Zap } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToday } from '../hooks/useToday'
import { computeScore } from '../utils/score'
import { buildInsight } from '../services/ai'
import { formatDuration, formatNumber, litres } from '../utils/format'
import { greeting, longDate } from '../utils/dates'
import { useNav } from '../contexts/NavContext'
import { daysLeft, fetchMembership } from '../services/gym'
import { selfRemind, unreadCount } from '../services/comms'
import { useAsync } from '../hooks/useAsync'
import { Sheet } from '../components/ui/Sheet'
import { DailyScoreCard } from '../components/dashboard/DailyScoreCard'
import { MetricCard } from '../components/dashboard/MetricCard'
import { RecoveryCard } from '../components/dashboard/RecoveryCard'
import { TodayWorkoutCard } from '../components/dashboard/TodayWorkoutCard'
import { LogSheet } from '../components/dashboard/LogSheet'
import { CoachCard } from '../components/ai/CoachCard'
import { Skeleton } from '../components/ui/Skeleton'
import { Button } from '../components/ui/Button'

type Kind = 'steps' | 'water' | 'calories' | 'heart' | 'sleep'

export function TodayPage() {
  const { profile } = useAuth()
  const nav = useNav()
  const unread = useAsync(() => unreadCount(profile!.id), [profile?.id])
  const [logMenu, setLogMenu] = useState(false)
  const { data, loading, error, reload } = useToday(profile?.id)
  const [sheet, setSheet] = useState<Kind | null>(null)
  const score = useMemo(() => (data ? computeScore(data, data.goals) : null), [data])
  const insight = useMemo(() => (data && score ? buildInsight(data, score) : null), [data, score])
  useEffect(() => {
    if (!profile) return
    void fetchMembership(profile.id).then((m) => {
      const left = daysLeft(m)
      if (m && left != null && left >= 0 && left <= 7) void selfRemind(profile, 'membership_expiring', 'Membership renews soon', `Your membership ends in ${left} day${left === 1 ? '' : 's'}.`).then(() => unread.reload())
    }).catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])
  if (!profile) return null

  const first = profile.full_name.split(' ')[0] || 'there'
  const staff = profile.role !== 'member'

  return (
    <div className="grid gap-4">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={profile.full_name} path={profile.avatar_url} size={48} shape={readShape()} />
          <div>
            <p className="text-sm text-ink2">{longDate()}</p>
            <h1 className="text-2xl font-extrabold">{greeting()}, {first}</h1>
          </div>
        </div>
        <button aria-label={`Notifications${unread.data ? `, ${unread.data} unread` : ''}`} onClick={() => nav.open('notifications')} className="relative flex h-11 w-11 items-center justify-center rounded-full bg-card shadow-card">
          <Bell size={20} />
          {!!unread.data && <span className="tabular absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-bad px-1 text-[11px] font-bold text-white">{unread.data}</span>}
        </button>
      </header>

      {staff && (
        <button onClick={() => nav.open('team')} className="rounded-tile bg-card2 p-3 text-left text-sm text-ink2">Signed in as <b className="text-ink">{profile.role}</b>. Tap to manage {profile.role === 'trainer' ? 'your clients' : 'members'}.</button>
      )}

      {loading && <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-72" /><Skeleton className="h-72" /></div>}

      {error && (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-card border border-line bg-card p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-bad"><AlertTriangle size={18} />Could not load your data</p>
          <p className="text-sm text-ink2">{error}</p>
          <Button variant="soft" onClick={() => void reload()}>Try again</Button>
        </div>
      )}

      {data && score && insight && (
        <>
          {!data.hasAnyData && (
            <p className="rounded-tile bg-card2 p-3 text-sm text-ink2">No data yet today. Tap a card below to log steps, water, sleep or heart rate. Import band data on the Health page.</p>
          )}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-12">
            <div className="lg:col-span-5"><DailyScoreCard score={score} /></div>
            <div className="grid gap-4 lg:col-span-7">
              <div className="grid grid-cols-2 gap-4">
                <MetricCard color="steps" icon={<Footprints size={18} />} label="Steps" value={data.steps ? formatNumber(data.steps) : null} sub={`Goal ${formatNumber(data.goals.steps)}`} progress={(data.steps / data.goals.steps) * 100} onClick={() => setSheet('steps')} />
                <MetricCard color="sleep" icon={<Moon size={18} />} label="Sleep" value={data.sleep ? formatDuration(data.sleep.duration_min) : null} sub={score.sleepScore != null ? `Sleep score ${score.sleepScore}` : 'Tap to log'} progress={data.sleep ? (data.sleep.duration_min / data.goals.sleep_min) * 100 : undefined} onClick={() => nav.open('sleep')} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <MetricCard color="readiness" icon={<Zap size={18} />} label="Readiness" value={score.readiness == null ? null : String(score.readiness)} unit="/100" sub={score.readiness == null ? 'Needs sleep data' : 'From sleep + resting HR'} progress={score.readiness ?? undefined} />
                <MetricCard color="calories" icon={<Flame size={18} />} label="Calories" value={data.calories ? formatNumber(data.calories) : null} unit="kcal" sub={`Goal ${formatNumber(data.goals.calories)}`} progress={(data.calories / data.goals.calories) * 100} onClick={() => setSheet('calories')} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_1fr_auto] gap-3">
            <button onClick={() => setLogMenu(true)} className="flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-water/50 text-sm font-semibold"><Plus size={16} />Log</button>
            <button onClick={() => nav.go('fitness')} className="flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-workout/50 text-sm font-semibold"><Play size={16} />Start</button>
            <button onClick={() => nav.open('health')} className="flex min-h-[48px] items-center justify-center rounded-full bg-card2 px-4 text-sm font-semibold">Health</button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard color="water" icon={<Droplets size={18} />} label="Water" value={data.waterMl ? litres(data.waterMl) : null} unit="L" sub={`Goal ${litres(data.goals.water_ml)} L`} progress={(data.waterMl / data.goals.water_ml) * 100} onClick={() => setSheet('water')}>
              <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1 text-xs font-semibold text-bg"><Plus size={14} />Add</span>
            </MetricCard>
            <MetricCard color="heart" icon={<Heart size={18} />} label="Heart rate" value={data.heartRate ? String(data.heartRate) : null} unit="bpm" sub={data.restingHr ? `Resting ${data.restingHr} bpm` : 'Tap to log'} onClick={() => setSheet('heart')} />
            <RecoveryCard score={score} data={data} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <TodayWorkoutCard workout={data.workout} onOpen={() => nav.go('fitness')} />
            <CoachCard insight={insight} />
          </div>

          <Sheet open={logMenu} title="What do you want to log?" onClose={() => setLogMenu(false)}>
            <div className="grid grid-cols-2 gap-2">
              {([['steps', 'Steps'], ['water', 'Water'], ['calories', 'Calories burned'], ['heart', 'Heart rate']] as const).map(([k, l]) => <button key={k} onClick={() => { setLogMenu(false); setSheet(k) }} className="min-h-[56px] rounded-tile bg-card2 text-sm font-semibold">{l}</button>)}
              <button onClick={() => { setLogMenu(false); nav.open('sleep') }} className="min-h-[56px] rounded-tile bg-card2 text-sm font-semibold">Sleep</button>
              <button onClick={() => { setLogMenu(false); nav.go('fitness') }} className="min-h-[56px] rounded-tile bg-card2 text-sm font-semibold">Food</button>
            </div>
          </Sheet>
          <LogSheet open={sheet != null} kind={sheet ?? 'steps'} profile={profile} onClose={() => setSheet(null)} onSaved={() => void reload()} />
        </>
      )}
    </div>
  )
}
