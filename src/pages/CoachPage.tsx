import { useEffect, useRef, useState } from 'react'
import { Send, Sparkles, Trash2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { askCoach, clearChat, fetchChat } from '../services/coach'
import { useAsync } from '../hooks/useAsync'
import type { ChatMsg } from '../types'
import { PageHeader } from '../components/ui/PageHeader'
import { ErrorBox, LoadingBlocks, Notice } from '../components/ui/StateViews'

const SUGGESTIONS = ['How is my recovery this week?', 'What should I train today?', 'How can I hit my protein target?', 'Tips to sleep better']

export function CoachPage() {
  const { profile } = useAuth()
  const hist = useAsync(() => fetchChat(profile!.id), [profile?.id])
  const [msgs, setMsgs] = useState<ChatMsg[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => { if (hist.data) setMsgs(hist.data) }, [hist.data])
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [msgs, busy])
  if (!profile) return null

  async function send(q: string) {
    const question = q.trim()
    if (!question || busy) return
    setBusy(true); setErr(null); setText('')
    setMsgs((m) => [...m, { role: 'user', content: question }])
    try {
      const a = await askCoach(profile!, question)
      setMsgs((m) => [...m, { role: 'assistant', content: a }])
    } catch (e) { setErr(e instanceof Error ? e.message : 'Something went wrong.') } finally { setBusy(false) }
  }

  return (
    <div className="grid gap-4">
      <PageHeader title="AI Coach" right={msgs.length ? <button aria-label="Clear conversation" onClick={() => { if (window.confirm('Clear this conversation?')) void clearChat(profile.id).then(() => setMsgs([])) }} className="flex h-10 w-10 items-center justify-center rounded-full bg-card2"><Trash2 size={16} /></button> : undefined} />
      <Notice text="The coach reads your own logged data. It is not a doctor: for pain, injury or medical concerns, see a professional." />
      {hist.loading ? <LoadingBlocks n={1} /> : hist.error ? <ErrorBox message={hist.error} onRetry={() => void hist.reload()} /> : (
        <div className="grid gap-3" aria-live="polite">
          {!msgs.length && (
            <div className="grid gap-2 rounded-card bg-ai/40 p-4"><p className="flex items-center gap-2 text-sm font-bold text-ink"><Sparkles size={16} />Ask me anything about your training</p>
              <div className="flex flex-wrap gap-2">{SUGGESTIONS.map((s) => <button key={s} onClick={() => void send(s)} className="min-h-[44px] rounded-full bg-card px-4 text-sm font-semibold text-ink">{s}</button>)}</div></div>
          )}
          {msgs.map((m, i) => <div key={i} className={`max-w-[88%] whitespace-pre-line rounded-[18px] px-4 py-3 text-sm ${m.role === 'user' ? 'justify-self-end bg-accent text-white' : 'justify-self-start bg-card shadow-card'}`}>{m.content}</div>)}
          {busy && <div className="justify-self-start rounded-[18px] bg-card px-4 py-3 text-sm text-ink2 shadow-card">Thinking…</div>}
          {err && <Notice text={err} tone="bad" />}
          <div ref={end} />
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); void send(text) }} className="sticky bottom-20 flex gap-2 lg:bottom-4">
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder="Ask your coach…" aria-label="Message to AI coach" className="min-h-[48px] flex-1 rounded-full border border-line bg-card px-4 text-sm" />
        <button type="submit" aria-label="Send" disabled={busy || !text.trim()} className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-white disabled:opacity-50"><Send size={18} /></button>
      </form>
    </div>
  )
}
