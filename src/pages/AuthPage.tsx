import { useState, type FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'

export function AuthPage() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setMsg(null)
    if (!/^\S+@\S+\.\S+$/.test(email)) { setMsg({ ok: false, text: 'Enter a valid email address.' }); return }
    if (pw.length < 8) { setMsg({ ok: false, text: 'Password needs at least 8 characters.' }); return }
    if (mode === 'up' && name.trim().length < 2) { setMsg({ ok: false, text: 'Enter your name.' }); return }
    setBusy(true)
    const res = mode === 'in' ? await signIn(email.trim(), pw) : await signUp(name.trim(), email.trim(), pw)
    setBusy(false)
    if (res === 'CONFIRM') setMsg({ ok: true, text: 'Check your email to confirm your account, then sign in.' })
    else if (res) setMsg({ ok: false, text: res })
  }

  const field = 'min-h-[48px] w-full rounded-tile border border-line bg-card px-3 text-base'
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-4 text-ink">
      <form onSubmit={(e) => void submit(e)} className="grid w-full max-w-sm gap-4 rounded-card border border-line bg-card p-6 shadow-card animate-rise">
        <div>
          <div className="text-2xl font-extrabold tracking-tight">FIT<span className="text-accent">4</span>LIFE</div>
          <p className="text-sm text-ink2">{mode === 'in' ? 'Sign in to your training app' : 'Create your account'}</p>
        </div>
        {mode === 'up' && (
          <div className="grid gap-1"><label htmlFor="nm" className="text-sm font-semibold">Full name</label><input id="nm" autoComplete="name" className={field} value={name} onChange={(e) => setName(e.target.value)} /></div>
        )}
        <div className="grid gap-1"><label htmlFor="em" className="text-sm font-semibold">Email</label><input id="em" type="email" autoComplete="email" className={field} value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="grid gap-1"><label htmlFor="pw" className="text-sm font-semibold">Password</label><input id="pw" type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} className={field} value={pw} onChange={(e) => setPw(e.target.value)} /></div>
        {msg && <p role={msg.ok ? 'status' : 'alert'} className={`text-sm ${msg.ok ? 'text-good' : 'text-bad'}`}>{msg.text}</p>}
        <Button busy={busy} type="submit">{mode === 'in' ? 'Sign in' : 'Create account'}</Button>
        <button type="button" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setMsg(null) }} className="min-h-[44px] text-sm font-semibold text-accent">
          {mode === 'in' ? 'New here? Create an account' : 'Have an account? Sign in'}
        </button>
      </form>
    </div>
  )
}
