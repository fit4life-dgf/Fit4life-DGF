import { useMemo } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useNav } from '../../contexts/NavContext'
import { useAsync } from '../../hooks/useAsync'
import { fetchToday } from '../../services/health'
import { fetchProfileById } from '../../services/team'
import { fetchLibrary, fetchSetRows, muscleMapOf } from '../../services/workoutSystem'
import { restingHrScore, sleepScoreOf } from '../../utils/score'
import { readinessScore, recoveryMap, toEvents } from '../../utils/workoutMath'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card } from '../../components/ui/Card'
import { ProgressRing } from '../../components/ui/ProgressRing'
import { ErrorBox, LoadingBlocks } from '../../components/ui/StateViews'
import { MuscleBodyView } from '../../components/muscle3d/MuscleBodyView'
import { BODY_COLORS, MUSCLE_IDS, muscleName } from '../../components/muscle3d/muscleMap'
import { recoveryColors, STATUS_LABEL } from './recoveryColors'

const bar = { rested: 'bg-muted', fresh: 'bg-good', recovering: 'bg-warn', fatigued: 'bg-bad' } as const

/** 3D recovery map plus a readiness estimate. Works for the signed-in user, or for a client when opened by their trainer. */
export function RecoveryPage() {
  const { profile } = useAuth()
  const nav = useNav()
  const userId = nav.detail?.param || profile?.id || ''
  const own = userId === profile?.id
  const person = useAsync(() => (own ? Promise.resolve(null) : fetchProfileById(userId)), [userId, own])
  const lib = useAsync(fetchLibrary, [])
  const rows = useAsync(() => fetchSetRows(userId, 14), [userId])
  const today = useAsync(() => fetchToday(userId), [userId])

  const rec = useMemo(() => {
    if (!lib.data || !rows.data) return null
    return recoveryMap(toEvents(rows.data, muscleMapOf(lib.data)), MUSCLE_IDS)
  }, [lib.data, rows.data])

  if (!profile) return null
  if (lib.loading || rows.loading) return <LoadingBlocks n={3} />
  const err = lib.error ?? rows.error
  if (err) return <ErrorBox message={err} onRetry={() => { void lib.reload(); void rows.reload() }} />
  if (!rec) return null

  const trained = MUSCLE_IDS.filter((id) => rec[id].status !== 'rested')
  const musclePart = trained.length ? Math.round(trained.reduce((a, id) => a + rec[id].pct, 0) / trained.length) : null
  const t = today.data
  const sleepPart = t ? sleepScoreOf(t.sleep, t.goals.sleep_min) : null
  const hrPart = t ? restingHrScore(t.restingHr ?? t.sleep?.resting_hr ?? null) : null
  const ready = readinessScore({ sleep: sleepPart, restingHr: hrPart, muscles: musclePart })
  const sorted = [...trained].sort((a, b) => rec[a].pct - rec[b].pct)

  return (
    <div className="grid gap-4 [&>*]:min-w-0">
      <PageHeader title={own ? 'Recovery' : `${person.data?.full_name ?? 'Client'} · Recovery`} onBack={() => nav.back()} />
      <Card className="flex items-center gap-4">
        <ProgressRing value={ready ?? 0} size={110} stroke={10} color="readiness" label={ready == null ? 'Readiness not available' : `Readiness ${ready} out of 100`}>
          <span className="tabular text-3xl font-extrabold">{ready ?? '—'}</span>
        </ProgressRing>
        <div className="grid gap-1 text-sm">
          <h2 className="font-bold">Readiness estimate</h2>
          <p className="text-ink2">Sleep {sleepPart ?? '—'} · Resting heart rate {hrPart ?? '—'} · Muscle freshness {musclePart ?? '—'}</p>
          <p className="text-xs text-ink2">A simple estimate from your logged sleep, resting heart rate and training. It is not a diagnosis or a medical measurement.</p>
        </div>
      </Card>
      <MuscleBodyView colors={recoveryColors(rec)} height="h-[380px]" label="Muscle recovery map" />
      <ul className="flex flex-wrap gap-3 text-xs" aria-label="Legend">
        {(['fatigued', 'recovering', 'fresh', 'rested'] as const).map((s) => <li key={s} className="flex items-center gap-1.5"><span aria-hidden className="h-3 w-3 rounded-full" style={{ background: BODY_COLORS[s] }} />{STATUS_LABEL[s]}</li>)}
      </ul>
      <Card className="grid gap-3">
        <h2 className="text-sm font-bold">Muscles trained in the last 14 days</h2>
        {!sorted.length ? <p className="text-sm text-ink2">No strength training logged in the last 14 days, so every muscle counts as rested.</p> : (
          <ul className="grid gap-3">
            {sorted.map((id) => {
              const r = rec[id]
              return (
                <li key={id} className="grid gap-1">
                  <div className="flex items-center justify-between text-sm"><span className="font-semibold">{muscleName(id)}</span><span className="text-xs text-ink2">{STATUS_LABEL[r.status]}{r.hoursLeft ? ` · about ${r.hoursLeft} h to go` : ''}</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-card2" role="progressbar" aria-valuenow={r.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${muscleName(id)} recovery`}><div className={`h-full rounded-full ${bar[r.status]}`} style={{ width: `${r.pct}%` }} /></div>
                </li>
              )
            })}
          </ul>
        )}
        <p className="text-xs text-ink2">Times come from how many hard sets each muscle did (about 36–48 hours, longer after big sessions). Use them as a planning guide.</p>
      </Card>
    </div>
  )
}
