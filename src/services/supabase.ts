import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

/** False when the deployment is missing its environment variables. The UI shows a clear message instead of crashing. */
export const isConfigured = Boolean(url && key)

/** All app tables live in the `fit` schema. The key is the public (publishable) key: access is enforced by Row Level Security. */
export const supabase = createClient<any, 'fit'>(url ?? 'http://localhost:54321', key ?? 'missing-key', {
  db: { schema: 'fit' },
  auth: { persistSession: true, autoRefreshToken: true },
})
