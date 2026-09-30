import { useEffect } from 'react'
import type { Profile } from '../types'
import { isAuthorized, isNativeApp, lastSync, syncNativeHealth } from '../services/nativeHealth'

const MIN_GAP_MS = 10 * 60 * 1000

/** In the mobile app, quietly refreshes phone/watch data when the app opens or returns to the foreground. */
export function useNativeSync(profile: Profile | null): void {
  useEffect(() => {
    if (!profile || !isNativeApp()) return
    let busy = false
    const run = async () => {
      const last = lastSync()
      if (busy || (last && Date.now() - new Date(last.at).getTime() < MIN_GAP_MS)) return
      busy = true
      try { if (await isAuthorized()) await syncNativeHealth(profile, 3) } catch { /* the Health page shows errors on a manual sync */ } finally { busy = false }
    }
    void run()
    const onVis = () => { if (document.visibilityState === 'visible') void run() }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [profile])
}
