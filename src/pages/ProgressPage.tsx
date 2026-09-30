import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { PageHeader } from '../components/ui/PageHeader'
import { Segmented } from '../components/ui/Segmented'
import { TrendsView } from '../components/progress/TrendsView'
import { BodyView } from '../components/progress/BodyView'
import { PhotosView } from '../components/progress/PhotosView'
import { BadgesView } from '../components/progress/BadgesView'
import { TrainingView } from '../components/progress/TrainingView'

type View = 'trends' | 'training' | 'body' | 'photos' | 'badges'

export function ProgressPage() {
  const { profile } = useAuth()
  const [view, setView] = useState<View>('trends')
  if (!profile) return null
  return (
    <div className="grid gap-4">
      <PageHeader title="Progress" />
      <Segmented<View> label="Progress sections" value={view} onChange={setView} options={[{ id: 'trends', label: 'Trends' }, { id: 'training', label: 'Training' }, { id: 'body', label: 'Body' }, { id: 'photos', label: 'Photos' }, { id: 'badges', label: 'Badges' }]} />
      {view === 'trends' && <TrendsView profile={profile} />}
      {view === 'training' && <TrainingView userId={profile.id} />}
      {view === 'body' && <BodyView profile={profile} />}
      {view === 'photos' && <PhotosView profile={profile} />}
      {view === 'badges' && <BadgesView profile={profile} />}
    </div>
  )
}
