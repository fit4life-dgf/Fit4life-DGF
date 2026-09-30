import { useState } from 'react'
import { Sheet } from '../ui/Sheet'
import { Button } from '../ui/Button'
import { NumberField, ChoiceRow } from '../ui/NumberField'
import { Notice } from '../ui/StateViews'
import type { MealType, Profile } from '../../types'
import { addFood } from '../../services/nutrition'
import { defaultMeal, FOOD_PRESETS, presetToInput } from '../../utils/foods'

const MEALS: { id: MealType; label: string }[] = [
  { id: 'breakfast', label: 'Breakfast' }, { id: 'lunch', label: 'Lunch' }, { id: 'snack', label: 'Snack' }, { id: 'dinner', label: 'Dinner' },
]

interface Props { open: boolean; profile: Profile; onClose: () => void; onSaved: () => void }

export function AddFoodSheet({ open, profile, onClose, onSaved }: Props) {
  const [meal, setMeal] = useState<MealType>(defaultMeal())
  const [custom, setCustom] = useState(false)
  const [name, setName] = useState('')
  const [kcal, setKcal] = useState(200)
  const [protein, setProtein] = useState(10)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function save(run: () => Promise<void>) {
    setBusy(true); setErr(null)
    try { await run(); onSaved(); onClose(); setCustom(false); setName('') } catch (e) { setErr(e instanceof Error ? e.message : 'Could not save.') } finally { setBusy(false) }
  }

  return (
    <Sheet open={open} title="Add food" onClose={onClose}>
      <div className="grid gap-4">
        <ChoiceRow label="Meal" value={meal} options={MEALS} onChange={setMeal} />
        {err && <Notice text={err} tone="bad" />}
        {!custom ? (
          <>
            <p className="text-xs text-ink2">Tap a food to add it. Values are typical estimates.</p>
            <ul className="grid max-h-[42vh] gap-2 overflow-y-auto">
              {FOOD_PRESETS.map((p) => (
                <li key={p.name}><button disabled={busy} onClick={() => void save(() => addFood(profile, presetToInput(p, meal)))} className="flex w-full items-center justify-between rounded-tile bg-card2 px-3 py-3 text-left"><span className="text-sm font-semibold">{p.name}</span><span className="tabular text-xs text-ink2">{p.kcal} kcal · {p.p}g protein</span></button></li>
              ))}
            </ul>
            <Button variant="soft" onClick={() => setCustom(true)}>Add something else</Button>
          </>
        ) : (
          <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); if (name.trim().length < 2) { setErr('Enter a food name.'); return } void save(() => addFood(profile, { meal_type: meal, name: name.trim(), calories: kcal, protein_g: protein })) }}>
            <label className="grid gap-1 text-sm font-semibold">Food name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className="min-h-[44px] rounded-tile border border-line bg-bg px-3 text-sm font-normal" /></label>
            <NumberField label="Calories" value={kcal} step={25} min={0} max={5000} unit="kcal" onChange={setKcal} />
            <NumberField label="Protein" value={protein} step={1} min={0} max={200} unit="g" onChange={setProtein} />
            <Button type="submit" busy={busy}>Save</Button>
            <Button type="button" variant="ghost" onClick={() => setCustom(false)}>Back to list</Button>
          </form>
        )}
      </div>
    </Sheet>
  )
}
