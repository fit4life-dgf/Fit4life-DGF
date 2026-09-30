import { useState } from 'react'
import type { Exercise } from '../../types'
import { useAuth } from '../../contexts/AuthContext'
import { useNav } from '../../contexts/NavContext'
import { useAsync } from '../../hooks/useAsync'
import { fetchLibrary } from '../../services/workoutSystem'
import { ErrorBox, LoadingBlocks } from '../../components/ui/StateViews'
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
  if (!profile) return null
  if (lib.loading) return <LoadingBlocks n={3} />
  if (lib.error) return <ErrorBox message={lib.error} onRetry={() => void lib.reload()} />
  const library = lib.data ?? []
  const isClient = profile.role === 'member'

  if (open) {
    return <ExerciseDetail exercise={open} onBack={() => setOpen(null)}
      actionLabel={isClient ? 'Start this exercise' : undefined} onAction={isClient ? () => nav.open('workoutday', `ex:${open.id}`) : undefined} />
  }
  if (muscle) return <ExerciseLibrary muscleId={muscle} library={library} onBack={() => setMuscle(null)} onOpen={setOpen} />
  return <MuscleSelector title="Explore muscles" countFor={(m) => exercisesFor(library, m).length} onBack={() => nav.back()} onContinue={setMuscle} />
}
