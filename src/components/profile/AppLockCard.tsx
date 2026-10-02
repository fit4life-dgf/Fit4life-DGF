import { useEffect, useState } from 'react'
import { Fingerprint } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { disableLock, enableLock, lockEnabled, lockSupported, unlock } from '../../services/appLock'

export function AppLockCard() {
  const { session, profile } = useAuth()
  const uid = session?.user.id
  const [supported, setSupported] = useState<boolean | null>(null)
  const [on, setOn] = useState(() => (uid ? lockEnabled(uid) : false))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  useEffect(() => { void lockSupported().then(setSupported) }, [])
  if (!uid || !profile) return null

  async function turnOn() {
    setBusy(true); setMsg(null)
    try { await enableLock(uid as string, session?.user.email ?? profile?.full_name ?? 'member'); setOn(true); setMsg({ ok: true, text: 'App lock is on. It locks when you open the app and after 30 seconds away.' }) }
    catch (e) { setMsg({ ok: false, text: e instanceof Error && e.name !== 'NotAllowedError' ? e.message : 'Biometric setup was cancelled or is not set up on this device.' }) }
    finally { setBusy(false) }
  }
  async function turnOff() {
    setBusy(true); setMsg(null)
    if (await unlock(uid as string)) { disableLock(uid as string); setOn(false); setMsg({ ok: true, text: 'App lock is off.' }) }
    else setMsg({ ok: false, text: 'Verify with your fingerprint or face to turn the lock off.' })
    setBusy(false)
  }

  return (
    <Card className="grid gap-3">
      <h2 className="flex items-center gap-2 text-sm font-bold"><Fingerprint size={18} />App lock</h2>
      {supported === false
        ? <p className="text-sm text-ink2">Fingerprint or face unlock is not available here. Open the app on a phone with a fingerprint or face unlock set up, over a secure (https) link.</p>
        : <>
            <p className="text-sm text-ink2">Ask for your fingerprint or face before the app opens on this device. Your biometrics stay on your phone.</p>
            <Button variant={on ? 'soft' : 'primary'} busy={busy || supported === null} onClick={() => void (on ? turnOff() : turnOn())}>{on ? 'Turn off app lock' : 'Turn on fingerprint / face lock'}</Button>
          </>}
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`text-sm ${msg.ok ? 'text-good' : 'text-bad'}`}>{msg.text}</p>}
    </Card>
  )
}
