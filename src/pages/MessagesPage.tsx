import { useEffect, useMemo, useRef, useState } from 'react'
import { MessageCircle, Send } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useNav } from '../contexts/NavContext'
import { fetchInbox, fetchThread, markThreadRead, sendMessage } from '../services/comms'
import { fetchMyTrainer, fetchPeople, fetchProfileById } from '../services/team'
import { useAsync } from '../hooks/useAsync'
import { PageHeader } from '../components/ui/PageHeader'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorBox, LoadingBlocks, Notice } from '../components/ui/StateViews'

export function MessagesPage() {
  const { profile } = useAuth()
  const nav = useNav()
  const inbox = useAsync(() => fetchInbox(profile!.id), [profile?.id])
  const people = useAsync(fetchPeople, [])
  const trainer = useAsync(() => fetchMyTrainer(profile!.id), [profile?.id])
  const names = useMemo(() => new Map((people.data ?? []).map((p) => [p.id, p.full_name])), [people.data])
  if (!profile) return null

  const staff = (people.data ?? []).filter((p) => p.id !== profile.id && p.role !== 'member')
  const contacts = profile.role === 'member' ? [...(trainer.data ? [trainer.data] : []), ...staff.filter((s) => s.id !== trainer.data?.id)] : []
  const loading = inbox.loading || people.loading || trainer.loading
  const err = inbox.error ?? people.error ?? trainer.error

  return (
    <div className="grid gap-4">
      <PageHeader title="Messages" onBack={nav.back} />
      {loading ? <LoadingBlocks n={3} h="h-16" /> : err ? <ErrorBox message={err} onRetry={() => { void inbox.reload(); void people.reload() }} /> : (
        <>
          {contacts.length > 0 && <section className="grid gap-2"><h2 className="text-sm font-bold">Message your coach</h2><ul className="grid gap-2">{contacts.map((c) => (
            <li key={c.id}><button onClick={() => nav.open('chat', c.id)} className="flex w-full items-center justify-between rounded-tile bg-card p-3 text-left shadow-card"><span className="text-sm font-bold">{c.full_name}</span><span className="text-xs capitalize text-ink2">{c.id === trainer.data?.id ? 'Your trainer' : c.role}</span></button></li>))}</ul></section>}
          <section className="grid gap-2"><h2 className="text-sm font-bold">Conversations</h2>
            {!(inbox.data ?? []).length ? <EmptyState icon={<MessageCircle />} title="No messages yet" text={profile.role === 'member' ? 'Pick a coach above to start a conversation.' : 'Open a client from the Team page to message them.'} /> :
              <ul className="grid gap-2">{(inbox.data ?? []).map((c) => (
                <li key={c.other}><button onClick={() => nav.open('chat', c.other)} className="flex w-full items-center justify-between gap-3 rounded-tile bg-card p-3 text-left shadow-card"><span className="min-w-0"><span className="block text-sm font-bold">{names.get(c.other) ?? 'Member'}</span><span className="block truncate text-xs text-ink2">{c.last.body}</span></span>{c.unread > 0 && <span className="tabular flex h-6 min-w-6 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-bold text-white">{c.unread}</span>}</button></li>))}</ul>}
          </section>
        </>
      )}
    </div>
  )
}

export function ChatPage() {
  const { profile } = useAuth()
  const nav = useNav()
  const other = nav.detail?.param ?? ''
  const who = useAsync(() => fetchProfileById(other), [other])
  const thread = useAsync(() => fetchThread(profile!.id, other), [profile?.id, other])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const end = useRef<HTMLDivElement>(null)
  const reloadRef = useRef(thread.reload)
  reloadRef.current = thread.reload

  useEffect(() => {
    if (!profile) return
    void markThreadRead(profile.id, other)
    const t = setInterval(() => { void reloadRef.current() }, 8000)
    return () => clearInterval(t)
  }, [profile, other])
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [thread.data])
  if (!profile) return null

  async function send() {
    if (!text.trim() || busy) return
    setBusy(true); setErr(null)
    try { await sendMessage(profile!, other, text); setText(''); await thread.reload() } catch (e) { setErr(e instanceof Error ? e.message : 'Could not send.') } finally { setBusy(false) }
  }

  return (
    <div className="grid gap-3">
      <PageHeader title={who.data?.full_name ?? 'Chat'} onBack={() => nav.open('messages')} />
      {thread.loading ? <LoadingBlocks n={2} h="h-12" /> : thread.error ? <ErrorBox message={thread.error} onRetry={() => void thread.reload()} /> : (
        <div className="grid gap-2" aria-live="polite">
          {!(thread.data ?? []).length && <p className="text-sm text-ink2">No messages yet. Say hello.</p>}
          {(thread.data ?? []).map((m) => <div key={m.id} className={`max-w-[85%] whitespace-pre-line rounded-[18px] px-4 py-2 text-sm ${m.sender_id === profile.id ? 'justify-self-end bg-accent text-white' : 'justify-self-start bg-card shadow-card'}`}>{m.body}<span className="mt-0.5 block text-[10px] opacity-70">{new Date(m.created_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</span></div>)}
          <div ref={end} />
        </div>
      )}
      {err && <Notice text={err} tone="bad" />}
      <form onSubmit={(e) => { e.preventDefault(); void send() }} className="sticky bottom-20 flex gap-2 lg:bottom-4">
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} placeholder="Message…" aria-label="Message" className="min-h-[48px] flex-1 rounded-full border border-line bg-card px-4 text-sm" />
        <button type="submit" aria-label="Send" disabled={busy || !text.trim()} className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-white disabled:opacity-50"><Send size={18} /></button>
      </form>
    </div>
  )
}
