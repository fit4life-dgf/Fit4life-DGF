import type { MemberDetails } from '../types'
import { clamp } from './format'

/** Metabolic equivalents (MET) by activity. Calories = MET x kg x hours. These are standard compendium approximations. */
export const MET: Record<string, number> = {
  Walking: 3.5, Running: 9, Cycling: 7, Spinning: 8, Strength: 5, HIIT: 8, Mobility: 2.5, Yoga: 2.5, Cardio: 7,
}

export function estimateBurn(category: string, minutes: number, weightKg: number | null): number {
  const met = MET[category] ?? 5
  const kg = weightKg && weightKg > 0 ? weightKg : 70
  return Math.round(met * kg * (minutes / 60))
}

export function ageFrom(dob: string | null, now: Date = new Date()): number | null {
  if (!dob) return null
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return null
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--
  return age
}

export interface Targets { calories: number; protein_g: number; carbs_g: number; fat_g: number }

/** Mifflin-St Jeor BMR x activity, adjusted for goal. Returns null when body details are missing. */
export function dailyTargets(m: MemberDetails | null): Targets | null {
  if (!m || !m.weight_kg || !m.height_cm || !m.gender) return null
  const age = ageFrom(m.dob)
  if (age == null) return null
  const bmr = 10 * m.weight_kg + 6.25 * m.height_cm - 5 * age + (m.gender === 'male' ? 5 : -161)
  const factor = m.activity_level === 'high' ? 1.725 : m.activity_level === 'moderate' ? 1.55 : 1.375
  const adj = m.goal === 'lose' ? -400 : m.goal === 'gain' ? 300 : 0
  const calories = Math.round(clamp(bmr * factor + adj, 1200, 5000) / 10) * 10
  const protein_g = Math.round(m.weight_kg * (m.goal === 'gain' ? 2 : 1.8))
  const fat_g = Math.round((calories * 0.25) / 9)
  const carbs_g = Math.max(0, Math.round((calories - protein_g * 4 - fat_g * 9) / 4))
  return { calories, protein_g, carbs_g, fat_g }
}

export function bmi(weightKg: number | null, heightCm: number | null): number | null {
  if (!weightKg || !heightCm) return null
  const h = heightCm / 100
  return Math.round((weightKg / (h * h)) * 10) / 10
}
