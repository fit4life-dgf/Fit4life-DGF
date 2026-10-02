import { useState } from 'react'
import type { Exercise } from '../../types'
import { useAuth } from '../../contexts/AuthContext'
import { useNav } from '../../contexts/NavContext'
import { useAsync } from '../../hooks/useAsync'
import { fetchLibrary } from '../../services/workoutSystem'
import { ErrorBox, LoadingBlocks } from '../../components/ui/StateViews'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { Segmented } from '../../components/ui/Segmented'
import { PageHeader } from '../../components/ui/PageHeader'
import { EmptyState } from '../../components/ui/EmptyState'
import { Dumbbell } from 'lucide-react'
import { MuscleBodyView, MuscleChips } from '../../components/muscle3d/MuscleBodyView'
import { MUSCLES } from '../../components/muscle3d/muscleMap'
import { MuscleSelector } from './MuscleSelector'
import { ExerciseLibrary, exercisesFor } from './ExerciseLibrary'
import { ExerciseDetail } from './ExerciseDetail'

/** Browse the exercise library by tapping the 3D body. Clients can start any exercise from here. */
export function MusclesPage() {
  const { profile } = useAuth()
  const nav = useNav()
  const lib = useAsync(fetchLibrary, [])
  const [muscle, setMuscle] = useState<string | null>(null)
  const [open, setOpen] = useState<Exercise | null>(null)
  const [gender, setGender] = useState<'male' | 'female'>('male')
  const wide = useMediaQuery('(min-width: 1024px)')
  if (!profile) return null
  if (lib.loading) return <LoadingBlocks n={3} />
  if (lib.error) return <ErrorBox message={lib.error} onRetry={() => void lib.reload()} />
  const library = lib.data ?? []
  const isClient = profile.role === 'member'

  if (wide) {
    // Desktop: body and muscle list on the left, exercises or the chosen exercise on the right.
    return (
      <div className="grid gap-4">
        <PageHeader title="Explore muscles" onBack={() => nav.back()} />
        <div className="grid grid-cols-2 items-start gap-6">
          <div className="sticky top-4 grid min-w-0 gap-3">
            <Segmented<'male' | 'female'> label="Body model" value={gender} onChange={setGender} options={[{ id: 'male', label: 'Male' }, { id: 'female', label: 'Female' }]} />
            <MuscleBodyView gender={gender} selected={muscle ? [muscle] : []} onSelect={(m) => { setMuscle(m); setOpen(null) }} autoFace viewModes height="h-[520px]" label="Muscle explorer" />
            <section className="grid gap-2 rounded-card bg-card p-4 shadow-card">
              <h2 className="text-sm font-bold">Select a muscle</h2>
              <MuscleChips selected={muscle ? [muscle] : []} onPick={(m) => { setMuscle(m); setOpen(null) }} only={MUSCLES.map((m) => m.id)} />
            </section>
          </div>
          <div className="min-w-0">
            {open ? (
              <ExerciseDetail stacked exercise={open} onBack={() => setOpen(null)}
                actionLabel={isClient ? 'Start this exercise' : undefined} onAction={isClient ? () => nav.open('workoutday', `ex:${open.id}`) : undefined} />
            ) : muscle ? (
              <ExerciseLibrary muscleId={muscle} library={library} onBack={() => setMuscle(null)} onOpen={setOpen} />
            ) : (
              <EmptyState icon={<Dumbbell />} title="Choose a muscle" text="Tap a muscle on the body or pick one from the list to see its exercises." />
            )}
          </div>
        </div>
      </div>
    )
  }

  if (open) {
    return <ExerciseDetail exercise={open} onBack={() => setOpen(null)}
      actionLabel={isClient ? 'Start this exercise' : undefined} onAction={isClient ? () => nav.open('workoutday', `ex:${open.id}`) : undefined} />
  }
  if (muscle) return <ExerciseLibrary muscleId={muscle} library={library} onBack={() => setMuscle(null)} onOpen={setOpen} />
  return <MuscleSelector title="Explore muscles" countFor={(m) => exercisesFor(library, m).length} onBack={() => nav.back()} onContinue={setMuscle} />
}
