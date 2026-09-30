import { Dumbbell } from 'lucide-react'
import type { WorkoutToday } from '../../types'
import { TINT } from '../ui/colors'

export function TodayWorkoutCard({ workout, onOpen }: { workout: WorkoutToday | null; onOpen: () => void }) {
  return (
    <section className={`rounded-card p-4 animate-rise ${TINT.workout}`} aria-label="Today's workout">
      <div className="flex items-center gap-2 text-sm font-semibold text-ink/80"><Dumbbell size={18} />Today’s workout</div>
      {workout ? (
        <>
          <h3 className="mt-2 text-lg font-extrabold text-ink">{workout.dayName}</h3>
          <p className="text-sm text-ink/70">{workout.focus} · {workout.exerciseCount} exercises{workout.estMinutes ? ` · ~${workout.estMinutes} min` : ''}</p>
          <button onClick={onOpen} className="mt-3 min-h-[44px] rounded-tile bg-ink px-5 text-sm font-semibold text-bg">Start workout</button>
        </>
      ) : (
        <>
          <h3 className="mt-2 text-lg font-extrabold text-ink">No workout assigned</h3>
          <p className="text-sm text-ink/70">Your trainer will assign a plan. Workout library arrives in Phase 3.</p>
        </>
      )}
    </section>
  )
}
