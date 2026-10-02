import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../services/supabase'
import type { Profile } from '../types'

interface AuthCtx {
  session: Session | null
  profile: Profile | null
  loading: boolean
  profileError: string | null
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (name: string, email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
  changePassword: (password: string) => Promise<string | null>
  refreshProfile: () => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileError, setProfileError] = useState<string | null>(null)

  const loadProfile = useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from('profiles').select('id,gym_id,role,full_name,avatar_url,phone').eq('id', uid).maybeSingle()
    if (error) {
      setProfile(null)
      setProfileError(error.message)
      return
    }
    setProfileError(data ? null : 'Your account is not linked to a gym yet. Please contact FIT4LIFE.')
    setProfile((data as Profile | null) ?? null)
  }, [])

  useEffect(() => {
    let alive = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return
      setSession(data.session)
      if (data.session) await loadProfile(data.session.user.id)
      if (alive) setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s)
      if (!s) {
        setProfile(null)
        setProfileError(null)
      } else {
        // defer: never call supabase inside the auth callback itself
        setTimeout(() => void loadProfile(s.user.id), 0)
      }
    })
    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  const value = useMemo<AuthCtx>(
    () => ({
      session,
      profile,
      loading,
      profileError,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        return error ? error.message : null
      },
      signUp: async (name, email, password) => {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(), password, options: { data: { full_name: name.trim() } },
        })
        if (error) return error.message
        return data.session ? null : 'CONFIRM'
      },
      signOut: async () => {
        await supabase.auth.signOut()
      },
      refreshProfile: async () => { if (session) await loadProfile(session.user.id) },
      changePassword: async (password) => {
        const { error } = await supabase.auth.updateUser({ password })
        return error ? error.message : null
      },
    }),
    [session, profile, loading, profileError, loadProfile],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth must be used inside AuthProvider')
  return v
}
