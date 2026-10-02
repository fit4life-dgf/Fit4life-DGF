import { useState, type FormEvent } from 'react'
import { Activity, Bell, Box, ChevronRight, CreditCard, LogOut, MessageCircle, Ruler, Users } from 'lucide-react'
import { useNav } from '../contexts/NavContext'
import type { ReactNode } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme, type ThemeMode } from '../contexts/ThemeContext'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { ProfilePhoto } from '../components/profile/ProfilePhoto'

const MODES: ThemeMode[] = ['system', 'light', 'dark']

function Row({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return <button onClick={onClick} className="flex min-h-[52px] w-full items-center gap-3 rounded-tile bg-card2 px-4 text-left text-sm font-semibold">{icon}<span className="flex-1">{label}</span><ChevronRight size={16} className="text-muted" /></button>
}

export function ProfilePage() {
  const { profile, session, signOut, changePassword } = useAuth()
  const { mode, setMode } = useTheme()
  const nav = useNav()
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  if (!profile) return null

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (pw.length < 8) { setMsg({ ok: false, text: 'Use at least 8 characters.' }); return }
    setBusy(true)
    const err = await changePassword(pw)
    setBusy(false)
    setMsg(err ? { ok: false, text: err } : { ok: true, text: 'Password updated.' })
    if (!err) setPw('')
  }

  return (
    <div className="grid max-w-xl gap-4">
      <h1 className="text-2xl font-extrabold">Profile</h1>
      <Card>
        <ProfilePhoto />
        <p className="mt-3 text-sm text-ink2">{session?.user.email}</p>
        <span className="mt-2 inline-block rounded-full bg-card2 px-3 py-1 text-xs font-bold capitalize">{profile.role}</span>
      </Card>
      <Card className="grid gap-2">
        <Row icon={<CreditCard size={18} />} label="Membership, attendance and payments" onClick={() => nav.open('membership')} />
        <Row icon={<MessageCircle size={18} />} label="Messages" onClick={() => nav.open('messages')} />
        <Row icon={<Bell size={18} />} label="Notifications" onClick={() => nav.open('notifications')} />
        <Row icon={<Activity size={18} />} label="Health data and goals" onClick={() => nav.open('health')} />
        <Row icon={<Ruler size={18} />} label="Body details" onClick={() => nav.open('bodydetails')} />
        {profile.role !== 'member' && <Row icon={<Users size={18} />} label={profile.role === 'trainer' ? 'My clients' : 'Members and gym admin'} onClick={() => nav.open('team')} />}
        {profile.role !== 'member' && <Row icon={<Box size={18} />} label="3D asset diagnostics" onClick={() => nav.open('assets3d')} />}
      </Card>
      <Card>
        <h2 className="mb-3 text-sm font-bold">Appearance</h2>
        <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2">
          {MODES.map((m) => (
            <button key={m} role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={`min-h-[44px] rounded-tile text-sm font-semibold capitalize ${mode === m ? 'bg-accent text-white' : 'bg-card2 text-ink'}`}>{m}</button>
          ))}
        </div>
      </Card>
      <Card>
        <form onSubmit={(e) => void submit(e)} className="grid gap-3">
          <label htmlFor="newpw" className="text-sm font-bold">Change password</label>
          <input id="newpw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password (8+ characters)" className="min-h-[44px] rounded-tile border border-line bg-bg px-3 text-sm" />
          {msg && <p role={msg.ok ? 'status' : 'alert'} className={`text-sm ${msg.ok ? 'text-good' : 'text-bad'}`}>{msg.text}</p>}
          <Button busy={busy} type="submit">Update password</Button>
        </form>
      </Card>
      <Button variant="soft" onClick={() => void signOut()}><LogOut size={18} />Sign out</Button>
    </div>
  )
}
