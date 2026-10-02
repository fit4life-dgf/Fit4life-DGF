const KEY = 'f4l_training_goal'
/** The training goal last chosen on this device. Falls back to hypertrophy when storage is unavailable. */
export const readGoal = (): string => { try { return localStorage.getItem(KEY) || 'hypertrophy' } catch { return 'hypertrophy' } }
export const writeGoal = (g: string): void => { try { localStorage.setItem(KEY, g) } catch { /* private mode */ } }
