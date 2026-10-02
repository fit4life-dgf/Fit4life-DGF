export type AppRole = 'owner' | 'admin' | 'trainer' | 'member'

export interface Profile {
  id: string
  gym_id: string
  role: AppRole
  full_name: string
  avatar_url: string | null
  phone: string | null
}

export type MetricType =
  | 'steps' | 'calories_burned' | 'heart_rate' | 'resting_hr'
  | 'spo2' | 'stress' | 'respiratory_rate' | 'hrv' | 'weight_kg'

export interface GoalTargets {
  steps: number
  water_ml: number
  calories: number
  sleep_min: number
}

export interface SleepRecord {
  id: string
  sleep_date: string
  duration_min: number
  deep_min: number | null
  rem_min: number | null
  light_min: number | null
  awake_min: number | null
  resting_hr: number | null
  score: number | null
  bedtime: string | null
  wake_time: string | null
}

export interface WorkoutToday {
  planName: string
  dayName: string
  focus: string
  exerciseCount: number
  estMinutes: number | null
}

export interface TodayData {
  steps: number
  calories: number
  heartRate: number | null
  restingHr: number | null
  waterMl: number
  sleep: SleepRecord | null
  goals: GoalTargets
  workout: WorkoutToday | null
  hasAnyData: boolean
}

export type ScoreLabel = 'Excellent' | 'Good' | 'Average' | 'Needs Recovery'

export interface ScorePart {
  key: 'sleep' | 'activity' | 'hydration' | 'recovery'
  label: string
  value: number | null
}

export interface ScoreResult {
  daily: number | null
  label: ScoreLabel | null
  readiness: number | null
  sleepScore: number | null
  parts: ScorePart[]
}

export interface CoachInsight {
  headline: string
  intensity: string
  suggestion: string
  hydration: string | null
  tone: 'good' | 'warn' | 'neutral'
}

export type TabId = 'today' | 'fitness' | 'coach' | 'progress' | 'profile'
export type MetricColor =
  | 'steps' | 'readiness' | 'sleep' | 'heart' | 'water'
  | 'calories' | 'workout' | 'recovery' | 'ai' | 'nutrition'

/* ---------- Navigation ---------- */
export type DetailId =
  | 'sleep' | 'health' | 'notifications' | 'messages' | 'chat' | 'membership'
  | 'team' | 'client' | 'admin' | 'workout' | 'exercises' | 'bodydetails'
  | 'muscles' | 'builder' | 'workoutday' | 'recovery' | 'assets3d'
export interface DetailState { id: DetailId; param?: string }
export interface Nav {
  tab: TabId
  go: (t: TabId) => void
  detail: DetailState | null
  open: (id: DetailId, param?: string) => void
  back: () => void
}

/* ---------- Workouts ---------- */
export interface Exercise {
  id: string
  name: string
  muscle: string
  equipment: string
  level: string
  cue: string | null
  primary_muscle?: string | null
  /** Secondary movers only (not stabilizers). */
  secondary?: string[]
  stabilizers?: string[]
  instructions?: string[]
  video_url?: string | null
  common_mistakes?: string[]
  breathing?: string | null
  tips?: string[]
  animation_url?: string | null
  animation_clip?: string | null
  is_compound?: boolean | null
  movement_pattern?: string | null
}
export interface PlanExercise {
  id: string
  exercise_id: string
  position: number
  sets: number
  reps: string
  rest_sec: number
  weight_kg?: number | null
  tempo?: string | null
  rpe?: number | null
  rir?: number | null
  notes?: string | null
  exercise: Exercise
}
export interface PlanDay {
  id: string
  name: string
  focus: string
  day_of_week: number
  est_minutes: number | null
  exercises: PlanExercise[]
}
export interface SessionRow {
  id: string
  name: string
  category: string
  started_at: string
  ended_at: string | null
  duration_min: number | null
  calories: number | null
}
export interface SetLogInput {
  exercise_id: string | null
  exercise_name: string
  set_no: number
  reps: number | null
  weight_kg: number | null
}
export interface WorkoutSeed {
  name: string
  category: string
  dayId: string | null
  exercises: { exercise: Exercise; sets: number; reps: string; rest_sec: number }[]
}

/* ---------- Nutrition ---------- */
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export interface FoodLog {
  id: string
  meal_type: MealType
  name: string
  calories: number
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  logged_at: string
}
export interface FoodInput {
  meal_type: MealType
  name: string
  calories: number
  protein_g?: number
  carbs_g?: number
  fat_g?: number
}
export interface DietPlan {
  id: string
  title: string
  notes: string | null
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  created_at: string
}
export interface MemberDetails {
  dob: string | null
  gender: 'male' | 'female' | null
  height_cm: number | null
  weight_kg: number | null
  goal: 'lose' | 'maintain' | 'gain' | null
  activity_level: 'low' | 'moderate' | 'high' | null
}

/* ---------- Progress ---------- */
export interface Measurement {
  id: string
  measured_on: string
  weight_kg: number | null
  body_fat_pct: number | null
  chest_cm: number | null
  waist_cm: number | null
  hips_cm: number | null
  arm_cm: number | null
  thigh_cm: number | null
}
export interface ProgressPhoto { id: string; taken_on: string; storage_path: string; note: string | null; url?: string }
export interface DayPoint { date: string; value: number }

/* ---------- Team / gym ---------- */
export interface PersonRow { id: string; full_name: string; role: AppRole; phone: string | null }
export interface MembershipPlan { id: string; name: string; price_inr: number; duration_days: number; active: boolean }
export interface Membership { id: string; plan_id: string | null; starts_on: string; ends_on: string; status: 'active' | 'expired' | 'paused' | 'cancelled' }
export interface Payment { id: string; amount_inr: number; method: string; status: string; reference: string | null; paid_at: string; user_id: string }
export interface AttendanceRow { id: string; checked_in_at: string; method: 'self' | 'staff'; user_id: string }

/* ---------- Communication ---------- */
export interface Message { id: string; sender_id: string; recipient_id: string; body: string; read_at: string | null; created_at: string }
export interface AppNotification { id: string; kind: string; title: string; body: string | null; read_at: string | null; created_at: string }
export interface ChatMsg { role: 'user' | 'assistant'; content: string }
