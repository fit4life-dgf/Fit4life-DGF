import { useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNav } from '../contexts/NavContext'
import { assignClient, assignRole, fetchPeople } from '../services/team'
import { fetchExpiring, fetchGymAttendanceToday, fetchPlans, recordPayment } from '../services/gym'
import { useAsync } from '../hooks/useAsync'
import type { AppRole, MembershipPlan, PersonRow } from '../types'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Sheet } from '../components/ui/Sheet'
import { ChoiceRow } from '../components/ui/NumberField'
import { ErrorBox, LoadingBlocks, Notice } from '../components/ui/StateViews'

type Sh = { kind: 'role' | 'trainer' | 'pay'; person: PersonRow } | null
const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`

export function AdminPage() {
  const { profile } = useAuth()
  const nav = useNav()
  const people = useAsync(fetchPeople, [])
  const plans = useAsync(fetchPlans, [])
  const today = useAsync(fetchGymAttendanceToday, [])
  const expiring = useAsync(() => fetchExpiring(7), [])
  const [sheet, setSheet] = useState<Sh>(null)
  const [plan, setPlan] = useState<string | null>(null)
  const [method, setMethod] = useState<'upi' | 'cash' | 'card' | 'bank'>('upi')
  const [ref, setRef] = useState('')
  const [msg, setMsg] = useState<{ t: string; tone: 'good' | 'bad' } | null>(null)
  const [busy, setBusy] = useState(false)
  const names = useMemo(() => new Map((people.data ?? []).map((p) => [p.id, p.full_name])), [people.data])
  if (!profile) return null
  const isOwner = profile.role === 'owner'
  const trainers = (people.data ?? []).filter((p) => p.role === 'trainer')

  async function run(fn: () => Promise<void>, ok: string) {
    setBusy(true); setMsg(null)
    try { await fn(); setSheet(null); setMsg({ t: ok, tone: 'good' }); await Promise.all([people.reload(), expiring.reload()]) } catch (e) { setMsg({ t: e instanceof Error ? e.message : 'Action failed.', tone: 'bad' }) } finally { setBusy(false) }
  }

  const chosen: MembershipPlan | undefined = plans.data?.find((p) => p.id === plan)

  return (
    <div className="grid gap-4">
      <PageHeader title="Gym admin" onBack={() => nav.open('team')} />
      {msg && <Notice text={msg.t} tone={msg.tone} />}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-steps/50 border-0"><p className="text-xs font-semibold text-ink/70">Check-ins today</p><p className="tabular text-3xl font-extrabold text-ink">{today.data ?? '—'}</p></Card>
        <Card className="bg-calories/50 border-0"><p className="text-xs font-semibold text-ink/70">Expiring in 7 days</p><p className="tabular text-3xl font-extrabold text-ink">{expiring.data?.length ?? '—'}</p></Card>
      </div>
      {(expiring.data ?? []).length > 0 && <Card className="grid gap-1 text-sm"><h2 className="font-bold">Renewals due</h2>{(expiring.data ?? []).map((e) => <p key={e.user_id} className="flex justify-between"><span>{names.get(e.user_id) ?? 'Member'}</span><span className="text-ink2">{e.ends_on}</span></p>)}</Card>}
      <h2 className="text-base font-bold">People</h2>
      {people.loading ? <LoadingBlocks n={3} h="h-16" /> : people.error ? <ErrorBox message={people.error} onRetry={() => void people.reload()} /> : (
        <ul className="grid gap-2">{(people.data ?? []).map((p) => (
          <li key={p.id} className="grid gap-2 rounded-tile bg-card p-3 shadow-card">
            <div className="flex items-center justify-between"><span className="text-sm font-bold">{p.full_name}</span><span className="rounded-full bg-card2 px-2 py-0.5 text-xs font-semibold capitalize">{p.role}</span></div>
            {p.role === 'member' && <div className="flex flex-wrap gap-2"><Button variant="soft" onClick={() => nav.open('client', p.id)}>Open</Button><Button variant="soft" onClick={() => { setPlan(plans.data?.[0]?.id ?? null); setRef(''); setSheet({ kind: 'pay', person: p }) }}>Record payment</Button>{trainers.length > 0 && <Button variant="soft" onClick={() => setSheet({ kind: 'trainer', person: p })}>Assign trainer</Button>}</div>}
            {isOwner && p.id !== profile.id && <Button variant="ghost" onClick={() => setSheet({ kind: 'role', person: p })}>Change role</Button>}
          </li>))}</ul>
      )}

      <Sheet open={sheet?.kind === 'role'} title={`Role for ${sheet?.person.full_name ?? ''}`} onClose={() => setSheet(null)}>
        <div className="grid gap-2"><p className="text-sm text-ink2">Only the owner can change roles.</p>
          {(['member', 'trainer', 'admin', 'owner'] as AppRole[]).map((r) => <Button key={r} variant={sheet?.person.role === r ? 'primary' : 'soft'} busy={busy} onClick={() => sheet && void run(() => assignRole(sheet.person.id, r), `${sheet.person.full_name} is now ${r}.`)}><span className="capitalize">{r}</span></Button>)}</div>
      </Sheet>
      <Sheet open={sheet?.kind === 'trainer'} title={`Trainer for ${sheet?.person.full_name ?? ''}`} onClose={() => setSheet(null)}>
        <div className="grid gap-2">{trainers.map((t) => <Button key={t.id} variant="soft" busy={busy} onClick={() => sheet && void run(() => assignClient(sheet.person.id, t.id), `${t.full_name} now coaches ${sheet.person.full_name}.`)}>{t.full_name}</Button>)}</div>
      </Sheet>
      <Sheet open={sheet?.kind === 'pay'} title={`Payment from ${sheet?.person.full_name ?? ''}`} onClose={() => setSheet(null)}>
        <div className="grid gap-3">
          {(plans.data ?? []).length === 0 ? <Notice text="No membership plans yet." /> : (
            <ChoiceRow<string> label="Plan" value={plan} onChange={setPlan} options={(plans.data ?? []).map((p) => ({ id: p.id, label: `${p.name} ${inr(p.price_inr)}` }))} />
          )}
          <ChoiceRow<'upi' | 'cash' | 'card' | 'bank'> label="Method" value={method} onChange={setMethod} options={[{ id: 'upi', label: 'UPI' }, { id: 'cash', label: 'Cash' }, { id: 'card', label: 'Card' }, { id: 'bank', label: 'Bank' }]} />
          <label className="grid gap-1 text-sm font-semibold">Reference (optional)<input value={ref} maxLength={60} onChange={(e) => setRef(e.target.value)} className="min-h-[44px] rounded-tile border border-line bg-bg px-3 text-sm font-normal" /></label>
          <p className="text-xs text-ink2">This records a payment you already received and extends the membership. It does not charge anyone.</p>
          <Button busy={busy} disabled={!chosen} onClick={() => sheet && chosen && void run(() => recordPayment(profile, sheet.person.id, chosen, method, ref.trim()), `Payment of ${inr(chosen.price_inr)} recorded.`)}>Record {chosen ? inr(chosen.price_inr) : ''}</Button>
        </div>
      </Sheet>
    </div>
  )
}
