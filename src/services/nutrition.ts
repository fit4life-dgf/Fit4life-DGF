import { supabase } from './supabase'
import type { DietPlan, FoodInput, FoodLog, MemberDetails, Profile } from '../types'
import { startOfToday } from '../utils/dates'

function fail(message: string): never { throw new Error(message) }

export async function fetchFoodToday(userId: string): Promise<FoodLog[]> {
  const { data, error } = await supabase.from('food_logs')
    .select('id,meal_type,name,calories,protein_g,carbs_g,fat_g,logged_at')
    .eq('user_id', userId).gte('logged_at', startOfToday().toISOString()).order('logged_at')
  if (error) fail(error.message)
  return (data ?? []) as FoodLog[]
}

export async function addFood(p: Profile, f: FoodInput): Promise<void> {
  const { error } = await supabase.from('food_logs').insert({ user_id: p.id, gym_id: p.gym_id, ...f })
  if (error) fail(error.message)
}

export async function deleteFood(id: string): Promise<void> {
  const { error } = await supabase.from('food_logs').delete().eq('id', id)
  if (error) fail(error.message)
}

export async function fetchDietPlan(userId: string): Promise<DietPlan | null> {
  const { data, error } = await supabase.from('diet_plans')
    .select('id,title,notes,calories,protein_g,carbs_g,fat_g,created_at')
    .eq('user_id', userId).eq('active', true).order('created_at', { ascending: false }).limit(1)
  if (error) fail(error.message)
  return ((data ?? [])[0] ?? null) as DietPlan | null
}

export async function assignDietPlan(staff: Profile, memberUserId: string, plan: { title: string; notes: string; calories: number; protein_g: number; carbs_g: number; fat_g: number }): Promise<void> {
  await supabase.from('diet_plans').update({ active: false }).eq('user_id', memberUserId).eq('active', true)
  const { error } = await supabase.from('diet_plans').insert({ user_id: memberUserId, gym_id: staff.gym_id, created_by: staff.id, ...plan })
  if (error) fail(error.message)
}

export async function fetchMemberDetails(userId: string): Promise<MemberDetails | null> {
  const { data, error } = await supabase.from('members').select('dob,gender,height_cm,weight_kg,goal,activity_level').eq('user_id', userId).maybeSingle()
  if (error) fail(error.message)
  return (data as MemberDetails | null) ?? null
}

export async function saveMemberDetails(p: Profile, d: MemberDetails): Promise<void> {
  const { data } = await supabase.from('members').select('id').eq('user_id', p.id).maybeSingle()
  const res = data
    ? await supabase.from('members').update(d).eq('user_id', p.id)
    : await supabase.from('members').insert({ user_id: p.id, gym_id: p.gym_id, ...d })
  if (res.error) fail(res.error.message)
}
