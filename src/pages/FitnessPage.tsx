import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { PageHeader } from '../components/ui/PageHeader'
import { Segmented } from '../components/ui/Segmented'
import { WorkoutsView } from '../components/fitness/WorkoutsView'
import { NutritionView } from '../components/nutrition/NutritionView'

type View = 'workouts' | 'nutrition'

export function FitnessPage() {
  const { profile } = useAuth()
  const [view, setView] = useState<View>('workouts')
  if (!profile) return null
  return (
    <div className="grid gap-4">
      <PageHeader title="Fitness" />
      <Segmented<View> label="Fitness sections" value={view} onChange={setView} options={[{ id: 'workouts', label: 'Workouts' }, { id: 'nutrition', label: 'Nutrition' }]} />
      {view === 'workouts' ? <WorkoutsView profile={profile} /> : <NutritionView profile={profile} />}
    </div>
  )
}
