import { useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import type { Exercise } from '../../types'
import { PageHeader } from '../../components/ui/PageHeader'
import { EmptyState } from '../../components/ui/EmptyState'
import { Button } from '../../components/ui/Button'
import { muscleName } from '../../components/muscle3d/muscleMap'
import { ExThumb } from './common'

interface Props {
  muscleId: string
  library: Exercise[]
  addedIds?: Set<string>
  onBack: () => void
  onOpen: (e: Exercise) => void
  onAdd?: (e: Exercise) => void
}

const LEVELS = ['All', 'Beginner', 'Intermediate', 'Advanced']

/** Exercises that train a muscle: primary movers first, then those where it assists. */
export function exercisesFor(library: Exercise[], muscleId: string): Exercise[] {
  const prim = library.filter((e) => e.primary_muscle === muscleId)
  const sec = library.filter((e) => e.primary_muscle !== muscleId && (e.secondary ?? []).includes(muscleId))
  return [...prim, ...sec]
}

/** Screen 2: exercise list for the chosen muscle, with equipment / level filters and add buttons. */
export function ExerciseLibrary({ muscleId, library, addedIds, onBack, onOpen, onAdd }: Props) {
  const all = useMemo(() => exercisesFor(library, muscleId), [library, muscleId])
  const equipment = useMemo(() => ['All', ...Array.from(new Set(all.map((e) => e.equipment))).sort()], [all])
  const [eq, setEq] = useState('All')
  const [lvl, setLvl] = useState('All')
  const [q, setQ] = useState('')
  const shown = all.filter((e) => (eq === 'All' || e.equipment === eq) && (lvl === 'All' || e.level === lvl) && e.name.toLowerCase().includes(q.trim().toLowerCase()))
  const chip = (on: boolean) => `min-h-[40px] shrink-0 rounded-full px-3 text-sm font-semibold ${on ? 'bg-accent text-white' : 'bg-card2'}`
  return (
    <div className="grid gap-4">
      <PageHeader title={muscleName(muscleId)} onBack={onBack} />
      <label className="flex min-h-[44px] items-center gap-2 rounded-tile border border-line bg-card px-3">
        <Search size={16} className="text-ink2" aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search exercises" aria-label="Search exercises" className="min-h-[40px] flex-1 bg-transparent text-sm outline-none" />
      </label>
      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Equipment">{equipment.map((x) => <button key={x} onClick={() => setEq(x)} aria-pressed={eq === x} className={chip(eq === x)}>{x}</button>)}</div>
      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Difficulty">{LEVELS.map((x) => <button key={x} onClick={() => setLvl(x)} aria-pressed={lvl === x} className={chip(lvl === x)}>{x}</button>)}</div>
      {!shown.length ? <EmptyState icon={<Search />} title="No exercises match" text="Try another filter or clear the search." /> : (
        <ul className="grid gap-2">
          {shown.map((e) => {
            const added = addedIds?.has(e.id)
            return (
              <li key={e.id} className="flex items-center gap-3 rounded-tile bg-card p-3 shadow-card">
                <button onClick={() => onOpen(e)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`Open ${e.name}`}>
                  <ExThumb ex={e} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{e.name}</span>
                    <span className="block text-xs text-ink2">{e.level} · {e.primary_muscle === muscleId ? 'Primary' : 'Assists'}</span>
                  </span>
                </button>
                {onAdd && <Button variant={added ? 'soft' : 'primary'} onClick={() => onAdd(e)} aria-label={`Add ${e.name}`} className="h-11 w-11 shrink-0 !px-0"><Plus size={18} /></Button>}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
