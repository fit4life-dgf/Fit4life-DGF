import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ScanFace } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../ui/Button'
import { lockEnabled, unlock } from '../../services/appLock'

const RELOCK_MS = 30_000

/** Covers the app until the device biometric succeeds. Locks on open and after 30s in the background. */
export function AppLockGate({ children }: { children: ReactNode }) {
  const { session, signOut } = useAuth()
  const uid = session?.user.id ?? null
  const [locked, setLocked] = useState(() => false)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const hiddenAt = useRef<number | null>(null)
  const seen = useRef<string | null>(null)

  useEffect(() => {
    if (uid && seen.current !== uid) { seen.current = uid; setLocked(lockEnabled(uid)) }
    if (!uid) { seen.current = null; setLocked(false) }
  }, [uid])

  useEffect(() => {
    const onVis = () => {
      if (document.hidden) hiddenAt.current = Date.now()
      else if (hiddenAt.current && Date.now() - hiddenAt.current > RELOCK_MS && uid && lockEnabled(uid)) setLocked(true)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [uid])

  const attempt = useCallback(async () => {
    if (!uid) return
    setBusy(true); setFailed(false)
    const ok = await unlock(uid)
    setBusy(false)
    if (ok) setLocked(false); else setFailed(true)
  }, [uid])

  useEffect(() => { if (locked) void attempt() }, [locked, attempt])

  if (!uid || !locked) return <>{children}</>
  return (
    <div role="dialog" aria-label="App locked" className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 bg-bg p-6 text-center text-ink">
      <div className="text-2xl font-extrabold tracking-tight">FIT<span className="text-accent">4</span>LIFE</div>
      <span className="flex h-24 w-24 items-center justify-center rounded-full bg-card2 text-accent"><ScanFace size={48} /></span>
      <p className="text-lg font-bold">App locked</p>
      <p className="max-w-xs text-sm text-ink2">Use your fingerprint or face to continue.</p>
      {failed && <p role="alert" className="text-sm text-bad">Could not verify. Try again.</p>}
      <div className="grid w-full max-w-xs gap-2">
        <Button busy={busy} onClick={() => void attempt()}>Unlock</Button>
        <Button variant="ghost" onClick={() => void signOut()}>Sign out instead</Button>
      </div>
    </div>
  )
}
