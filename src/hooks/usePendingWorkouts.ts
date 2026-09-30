import { useEffect } from 'react'
import type { Profile } from '../types'
import { flushPending } from '../services/workoutSystem'

/** Uploads workouts that were finished while offline, when the app opens and whenever the connection returns. */
export function usePendingWorkouts(profile: Profile | null): void {
  const id = profile?.id
  const gym = profile?.gym_id
  useEffect(() => {
    if (!id || !gym) return
    const run = () => { void flushPending({ id, gym_id: gym }).catch(() => { /* stays queued for the next attempt */ }) }
    run()
    window.addEventListener('online', run)
    return () => window.removeEventListener('online', run)
  }, [id, gym])
}
