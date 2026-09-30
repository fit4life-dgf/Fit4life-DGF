import type { FoodInput, MealType } from '../types'

/** Approximate values per typical serving (common Indian and gym foods). Estimates only; users can edit before saving. */
export interface FoodPreset { name: string; kcal: number; p: number; c: number; f: number }
export const FOOD_PRESETS: FoodPreset[] = [
  { name: 'Idli (2)', kcal: 130, p: 4, c: 26, f: 1 },
  { name: 'Dosa (1 plain)', kcal: 170, p: 4, c: 28, f: 4 },
  { name: 'Chapati (1)', kcal: 100, p: 3, c: 18, f: 2 },
  { name: 'Steamed rice (1 cup)', kcal: 200, p: 4, c: 44, f: 0 },
  { name: 'Dal (1 cup)', kcal: 180, p: 10, c: 28, f: 3 },
  { name: 'Paneer (100 g)', kcal: 265, p: 18, c: 4, f: 20 },
  { name: 'Chicken breast (100 g)', kcal: 165, p: 31, c: 0, f: 4 },
  { name: 'Egg, boiled (1)', kcal: 78, p: 6, c: 1, f: 5 },
  { name: 'Fish curry (1 cup)', kcal: 210, p: 22, c: 6, f: 11 },
  { name: 'Curd (1 cup)', kcal: 150, p: 8, c: 11, f: 8 },
  { name: 'Milk (1 glass)', kcal: 120, p: 6, c: 10, f: 6 },
  { name: 'Banana (1)', kcal: 105, p: 1, c: 27, f: 0 },
  { name: 'Apple (1)', kcal: 95, p: 0, c: 25, f: 0 },
  { name: 'Oats (1 bowl)', kcal: 150, p: 5, c: 27, f: 3 },
  { name: 'Peanuts (30 g)', kcal: 170, p: 7, c: 5, f: 14 },
  { name: 'Whey protein (1 scoop)', kcal: 120, p: 24, c: 3, f: 1 },
  { name: 'Sprouts salad (1 bowl)', kcal: 120, p: 8, c: 20, f: 1 },
  { name: 'Biryani (1 plate)', kcal: 450, p: 18, c: 60, f: 15 },
]

export function presetToInput(p: FoodPreset, meal: MealType): FoodInput {
  return { meal_type: meal, name: p.name, calories: p.kcal, protein_g: p.p, carbs_g: p.c, fat_g: p.f }
}

export function defaultMeal(d: Date = new Date()): MealType {
  const h = d.getHours()
  if (h < 11) return 'breakfast'
  if (h < 16) return 'lunch'
  if (h < 19) return 'snack'
  return 'dinner'
}
