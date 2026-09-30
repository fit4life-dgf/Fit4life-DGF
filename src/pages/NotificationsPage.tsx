import { useEffect } from 'react'
import { Bell } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useNav } from '../contexts/NavContext'
import { fetchNotifications, markAllRead } from '../services/comms'
import { useAsync } from '../hooks/useAsync'
import { PageHeader } from '../components/ui/PageHeader'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorBox, LoadingBlocks } from '../components/ui/StateViews'

export function NotificationsPage() {
  const { profile } = useAuth()
  const nav = useNav()
  const list = useAsync(() => fetchNotifications(profile!.id), [profile?.id])
  useEffect(() => { if (profile) void markAllRead(profile.id).catch(() => undefined) }, [profile])
  if (!profile) return null
  return (
    <div className="grid gap-4">
      <PageHeader title="Notifications" onBack={nav.back} />
      {list.loading ? <LoadingBlocks n={3} h="h-16" /> : list.error ? <ErrorBox message={list.error} onRetry={() => void list.reload()} /> :
        !(list.data ?? []).length ? <EmptyState icon={<Bell />} title="You are all caught up" text="Messages, plans and membership updates will show here." /> :
          <ul className="grid gap-2">{(list.data ?? []).map((n) => (
            <li key={n.id} className={`rounded-tile p-3 shadow-card ${n.read_at ? 'bg-card' : 'bg-ai/30'}`}><p className="text-sm font-bold">{n.title}</p>{n.body && <p className="text-sm text-ink2">{n.body}</p>}<p className="mt-1 text-[11px] text-ink2">{new Date(n.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</p></li>))}</ul>}
    </div>
  )
}
