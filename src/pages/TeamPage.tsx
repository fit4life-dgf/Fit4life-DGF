import { useMemo, useState } from 'react'
import { Search, Shield, Users } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useNav } from '../contexts/NavContext'
import { fetchClients } from '../services/team'
import { useAsync } from '../hooks/useAsync'
import { PageHeader } from '../components/ui/PageHeader'
import { EmptyState } from '../components/ui/EmptyState'
import { Button } from '../components/ui/Button'
import { ErrorBox, LoadingBlocks } from '../components/ui/StateViews'

export function TeamPage() {
  const { profile } = useAuth()
  const nav = useNav()
  const clients = useAsync(() => fetchClients(profile!), [profile?.id])
  const [q, setQ] = useState('')
  const list = useMemo(() => (clients.data ?? []).filter((c) => c.full_name.toLowerCase().includes(q.trim().toLowerCase())), [clients.data, q])
  if (!profile) return null
  const admin = profile.role === 'owner' || profile.role === 'admin'
  return (
    <div className="grid gap-4">
      <PageHeader title={admin ? 'Members' : 'My clients'} onBack={nav.back} />
      {admin && <Button variant="soft" onClick={() => nav.open('admin')}><Shield size={18} />Gym admin</Button>}
      <label className="relative block"><span className="sr-only">Search clients</span><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name" className="min-h-[46px] w-full rounded-full border border-line bg-card pl-9 pr-4 text-sm" /></label>
      {clients.loading ? <LoadingBlocks n={3} h="h-16" /> : clients.error ? <ErrorBox message={clients.error} onRetry={() => void clients.reload()} /> :
        !list.length ? <EmptyState icon={<Users />} title={q ? 'No matches' : 'No clients yet'} text={q ? 'Try a different name.' : admin ? 'Members appear here after they sign up.' : 'The gym admin will assign clients to you.'} /> :
          <ul className="grid gap-2">{list.map((c) => <li key={c.id}><button onClick={() => nav.open('client', c.id)} className="flex w-full items-center justify-between rounded-tile bg-card p-3 text-left shadow-card"><span className="text-sm font-bold">{c.full_name}</span><span className="text-xs text-ink2">{c.phone ?? ''}</span></button></li>)}</ul>}
    </div>
  )
}
