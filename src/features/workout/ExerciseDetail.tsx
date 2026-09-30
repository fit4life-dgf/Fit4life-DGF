import type { Exercise } from '../../types'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { PageHeader } from '../../components/ui/PageHeader'
import { MuscleBodyView } from '../../components/muscle3d/MuscleBodyView'
import { muscleName } from '../../components/muscle3d/muscleMap'

interface Props { exercise: Exercise; onBack: () => void; actionLabel?: string; onAction?: () => void }

/** Screen 3: what the exercise is, how to do it, and which muscles it works (shown on the 3D body). */
export function ExerciseDetail({ exercise: e, onBack, actionLabel, onAction }: Props) {
  const prim = e.primary_muscle ? [e.primary_muscle] : []
  const sec = e.secondary ?? []
  return (
    <div className="grid gap-4">
      <PageHeader title={e.name} onBack={onBack} />
      {e.video_url ? (
        <video src={e.video_url} controls playsInline loop muted className="w-full rounded-card bg-card2" aria-label={`${e.name} demonstration`} />
      ) : (
        <MuscleBodyView selected={prim} secondary={sec} pulse={prim} height="h-[300px]" controls={false} autoFace label={`Muscles worked by ${e.name}`} />
      )}
      {!e.video_url && <p className="text-xs text-ink2">Muscle activation view: the pulsing area is the main muscle worked. This is a training guide, not a medical measurement.</p>}
      <div className="flex flex-wrap gap-2 text-xs font-semibold">
        <span className="rounded-full bg-card2 px-3 py-1.5">{e.equipment}</span>
        <span className="rounded-full bg-card2 px-3 py-1.5">{e.level}</span>
      </div>
      <Card className="grid gap-2 text-sm">
        <h2 className="font-bold">Muscles worked</h2>
        <p><span className="font-semibold">Primary: </span>{prim.length ? prim.map(muscleName).join(', ') : e.muscle}</p>
        <p><span className="font-semibold">Secondary: </span>{sec.length ? sec.map(muscleName).join(', ') : 'None listed'}</p>
      </Card>
      {(e.instructions ?? []).length > 0 && (
        <Card className="grid gap-2">
          <h2 className="text-sm font-bold">How to do it</h2>
          <ol className="grid gap-2 text-sm">{(e.instructions ?? []).map((s, i) => <li key={i} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">{i + 1}</span><span>{s}</span></li>)}</ol>
        </Card>
      )}
      {e.cue && <Card className="bg-workout/30 border-0 text-sm"><span className="font-bold">Coaching cue: </span>{e.cue}</Card>}
      {onAction && actionLabel && <Button onClick={onAction}>{actionLabel}</Button>}
    </div>
  )
}
