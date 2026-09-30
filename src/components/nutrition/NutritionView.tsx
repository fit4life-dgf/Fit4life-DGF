import { useState } from 'react'
import { Droplets, Plus, Trash2, UtensilsCrossed } from 'lucide-react'
import type { FoodLog, MealType, Profile } from '../../types'
import { deleteFood, fetchDietPlan, fetchFoodToday, fetchMemberDetails } from '../../services/nutrition'
import { logWater } from '../../services/health'
import { fetchWaterSeries } from '../../services/progress'
import { useAsync } from '../../hooks/useAsync'
import { dailyTargets } from '../../utils/energy'
import { formatNumber, litres } from '../../utils/format'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { ProgressRing } from '../ui/ProgressRing'
import { ErrorBox, LoadingBlocks, Notice } from '../ui/StateViews'
import { EmptyState } from '../ui/EmptyState'
import { useNav } from '../../contexts/NavContext'
import { AddFoodSheet } from './AddFoodSheet'

const MEALS: { id: MealType; label: string }[] = [
  { id: 'breakfast', label: 'Breakfast' }, { id: 'lunch', label: 'Lunch' }, { id: 'snack', label: 'Snacks' }, { id: 'dinner', label: 'Dinner' },
]

function Macro({ label, value, target, color }: { label: string; value: number; target: number | null; color: string }) {
  const pct = target ? Math.min(100, (value / target) * 100) : 0
  return (
    <div className="grid gap-1"><div className="flex justify-between text-xs"><span className="font-semibold text-ink2">{label}</span><span className="tabular font-bold">{Math.round(value)}{target ? ` / ${target}` : ''} g</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-card2"><div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} /></div></div>
  )
}

export function NutritionView({ profile }: { profile: Profile }) {
  const nav = useNav()
  const food = useAsync(() => fetchFoodToday(profile.id), [profile.id])
  const plan = useAsync(() => fetchDietPlan(profile.id), [profile.id])
  const details = useAsync(() => fetchMemberDetails(profile.id), [profile.id])
  const water = useAsync(async () => (await fetchWaterSeries(profile.id, 1))[0]?.value ?? 0, [profile.id])
  const [adding, setAdding] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const logs: FoodLog[] = food.data ?? []
  const eaten = logs.reduce((s, l) => s + l.calories, 0)
  const sum = (k: 'protein_g' | 'carbs_g' | 'fat_g') => logs.reduce((s, l) => s + Number(l[k] ?? 0), 0)
  const est = dailyTargets(details.data ?? null)
  const target = plan.data?.calories ?? est?.calories ?? null
  const macroT = { p: plan.data?.protein_g ?? est?.protein_g ?? null, c: plan.data?.carbs_g ?? est?.carbs_g ?? null, f: plan.data?.fat_g ?? est?.fat_g ?? null }

  async function addWater(ml: number) {
    setErr(null)
    try { await logWater(profile, ml); await water.reload() } catch (e) { setErr(e instanceof Error ? e.message : 'Could not save.') }
  }

  if (food.loading || plan.loading || details.loading) return <LoadingBlocks n={3} h="h-40" />
  if (food.error) return <ErrorBox message={food.error} onRetry={() => void food.reload()} />

  return (
    <div className="grid gap-4">
      {err && <Notice text={err} tone="bad" />}
      {plan.data && (
        <Card className="bg-nutrition/40 border-0"><p className="text-xs font-semibold text-ink/70">Plan from your trainer</p><h3 className="font-extrabold text-ink">{plan.data.title}</h3>{plan.data.notes && <p className="mt-1 whitespace-pre-line text-sm text-ink/80">{plan.data.notes}</p>}</Card>
      )}
      <Card className="grid gap-4">
        <div className="flex items-center gap-4">
          <ProgressRing value={target ? (eaten / target) * 100 : 0} size={120} stroke={11} color="nutrition" label={`Calories eaten ${eaten}${target ? ` of ${target}` : ''}`}>
            <span className="tabular text-2xl font-extrabold">{formatNumber(eaten)}</span><span className="text-[11px] text-ink2">kcal eaten</span>
          </ProgressRing>
          <div className="flex-1 text-sm">
            {target ? <><p className="font-semibold">Target {formatNumber(target)} kcal</p><p className="text-ink2">{eaten <= target ? `${formatNumber(target - eaten)} kcal left` : `${formatNumber(eaten - target)} kcal over`}</p></> :
              <p className="text-ink2">Add your height, weight and goal to get a calorie target.</p>}
            {!plan.data && est && <p className="mt-1 text-xs text-ink2">Estimated from your body details (Mifflin-St Jeor).</p>}
          </div>
        </div>
        {!target && <Button variant="soft" onClick={() => nav.open('bodydetails')}>Add body details</Button>}
        <Macro label="Protein" value={sum('protein_g')} target={macroT.p} color="bg-heart" />
        <Macro label="Carbs" value={sum('carbs_g')} target={macroT.c} color="bg-calories" />
        <Macro label="Fat" value={sum('fat_g')} target={macroT.f} color="bg-sleep" />
      </Card>

      <Button onClick={() => setAdding(true)}><Plus size={18} />Add food</Button>

      {!logs.length ? <EmptyState icon={<UtensilsCrossed />} title="Nothing logged today" text="Tap Add food and pick what you ate. It takes a couple of taps." /> :
        MEALS.map((m) => {
          const items = logs.filter((l) => l.meal_type === m.id)
          if (!items.length) return null
          return (
            <section key={m.id} aria-label={m.label} className="grid gap-2">
              <h3 className="flex justify-between text-sm font-bold">{m.label}<span className="tabular font-semibold text-ink2">{items.reduce((s, l) => s + l.calories, 0)} kcal</span></h3>
              <ul className="grid gap-2">{items.map((l) => (
                <li key={l.id} className="flex items-center justify-between rounded-tile bg-card p-3 shadow-card"><span><span className="block text-sm font-semibold">{l.name}</span><span className="block text-xs text-ink2">{l.calories} kcal{l.protein_g != null ? ` · ${l.protein_g}g protein` : ''}</span></span>
                  <button aria-label={`Delete ${l.name}`} onClick={() => void deleteFood(l.id).then(() => food.reload()).catch((e: Error) => setErr(e.message))} className="flex h-10 w-10 items-center justify-center rounded-full text-ink2 hover:bg-card2"><Trash2 size={16} /></button></li>))}</ul>
            </section>
          )
        })}

      <Card className="grid gap-3 bg-water/40 border-0">
        <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-sm font-semibold text-ink"><Droplets size={18} />Water today</span><span className="tabular font-extrabold text-ink">{litres(water.data ?? 0)} L</span></div>
        <div className="flex flex-wrap gap-2">{[200, 250, 500, 750].map((n) => <button key={n} onClick={() => void addWater(n)} className="min-h-[44px] rounded-full bg-card px-4 text-sm font-semibold text-ink">+{n} ml</button>)}</div>
      </Card>

      <AddFoodSheet open={adding} profile={profile} onClose={() => setAdding(false)} onSaved={() => void food.reload()} />
    </div>
  )
}
