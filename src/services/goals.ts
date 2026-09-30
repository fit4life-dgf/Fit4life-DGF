import { supabase } from './supabase'
import type { GoalTargets } from '../types'
import { DEFAULT_GOALS } from './health'

export async function fetchGoals(userId: string): Promise<GoalTargets> {
  const { data, error } = await supabase.from('goals').select('type,target').eq('user_id', userId).eq('active', true)
  if (error) throw new Error(error.message)
  const g: GoalTargets = { ...DEFAULT_GOALS }
  for (const r of (data ?? []) as { type: string; target: number }[]) {
    if (r.type === 'steps') g.steps = Number(r.target)
    if (r.type === 'water_ml') g.water_ml = Number(r.target)
    if (r.type === 'calories') g.calories = Number(r.target)
    if (r.type === 'sleep_min') g.sleep_min = Number(r.target)
  }
  return g
}
