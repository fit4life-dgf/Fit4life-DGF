import { useState } from 'react'
import { Segmented } from '../../components/ui/Segmented'
import { Button } from '../../components/ui/Button'
import { PageHeader } from '../../components/ui/PageHeader'
import { MuscleBodyView, MuscleChips } from '../../components/muscle3d/MuscleBodyView'
import { MUSCLES, muscleName } from '../../components/muscle3d/muscleMap'

interface Props {
  title?: string
  hint?: string
  countFor: (muscleId: string) => number
  onContinue: (muscleId: string) => void
  onBack: () => void
}

/** Screen 1: pick a muscle on the 3D body (or from the list underneath). */
export function MuscleSelector({ title = 'Select muscle group', hint = 'Tap a muscle on the body. Drag to rotate.', countFor, onContinue, onBack }: Props) {
  const [gender, setGender] = useState<'male' | 'female'>('male')
  const [sel, setSel] = useState<string | null>(null)
  const n = sel ? countFor(sel) : 0
  return (
    <div className="grid gap-4 pb-28">
      <PageHeader title={title} onBack={onBack} />
      <Segmented<'male' | 'female'> label="Body model" value={gender} onChange={setGender} options={[{ id: 'male', label: 'Male' }, { id: 'female', label: 'Female' }]} />
      <p className="text-sm text-ink2">{hint}</p>
      <MuscleBodyView gender={gender} selected={sel ? [sel] : []} onSelect={setSel} autoFace label="Muscle selector" />
      <details className="rounded-tile bg-card p-3 shadow-card">
        <summary className="cursor-pointer text-sm font-semibold">Choose from a list</summary>
        <div className="mt-3"><MuscleChips selected={sel ? [sel] : []} onPick={setSel} only={MUSCLES.map((m) => m.id)} /></div>
      </details>
      <div className="sticky bottom-20 rounded-card border border-line bg-card p-4 shadow-card">
        {sel ? (
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-xs font-semibold text-ink2">Selected</p><p className="text-lg font-extrabold">{muscleName(sel)}</p><p className="text-xs text-ink2">{n} exercise{n === 1 ? '' : 's'}</p></div>
            <Button disabled={n === 0} onClick={() => onContinue(sel)}>View exercises</Button>
          </div>
        ) : <p className="text-sm text-ink2">No muscle selected yet.</p>}
      </div>
    </div>
  )
}
