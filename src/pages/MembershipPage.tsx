import { useState } from 'react'
import { CalendarCheck, CreditCard } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useNav } from '../contexts/NavContext'
import { checkIn, daysLeft, fetchAttendance, fetchMembership, fetchPayments, fetchPlans } from '../services/gym'
import { useAsync } from '../hooks/useAsync'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { ErrorBox, LoadingBlocks, Notice } from '../components/ui/StateViews'

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`
const fmt = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

export function MembershipPage() {
  const { profile } = useAuth()
  const nav = useNav()
  const mem = useAsync(() => fetchMembership(profile!.id), [profile?.id])
  const plans = useAsync(fetchPlans, [])
  const pay = useAsync(() => fetchPayments(profile!.id), [profile?.id])
  const att = useAsync(() => fetchAttendance(profile!.id, 60), [profile?.id])
  const [msg, setMsg] = useState<{ t: string; tone: 'good' | 'bad' | 'info' } | null>(null)
  const [busy, setBusy] = useState(false)
  if (!profile) return null

  const left = daysLeft(mem.data ?? null)
  const planName = plans.data?.find((p) => p.id === mem.data?.plan_id)?.name
  const err = mem.error ?? pay.error ?? att.error

  async function doCheckIn() {
    setBusy(true); setMsg(null)
    try { const r = await checkIn(profile!); setMsg(r === 'ok' ? { t: 'Checked in. Have a great session!', tone: 'good' } : { t: 'You are already checked in today.', tone: 'info' }); await att.reload() } catch (e) { setMsg({ t: e instanceof Error ? e.message : 'Could not check in.', tone: 'bad' }) } finally { setBusy(false) }
  }

  return (
    <div className="grid gap-4">
      <PageHeader title="Membership" onBack={nav.back} />
      {err && <ErrorBox message={err} onRetry={() => { void mem.reload(); void pay.reload(); void att.reload() }} />}
      {mem.loading ? <LoadingBlocks n={2} /> : (
        <Card className={`grid gap-1 border-0 ${left != null && left >= 0 ? 'bg-recovery/50' : 'bg-card2'}`}>
          {mem.data ? (<><p className="text-xs font-semibold text-ink/70">{planName ?? 'Membership'}</p>
            <p className="text-2xl font-extrabold text-ink">{left != null && left >= 0 ? `${left} day${left === 1 ? '' : 's'} left` : 'Expired'}</p>
            <p className="text-sm text-ink/70">{fmt(mem.data.starts_on)} to {fmt(mem.data.ends_on)}</p>
            {left != null && left >= 0 && left <= 7 && <p className="mt-1 text-sm font-semibold text-warn">Renews soon. Ask the front desk to renew.</p>}</>) :
            <p className="text-sm text-ink2">No membership on record. The front desk can activate one for you.</p>}
        </Card>
      )}
      {msg && <Notice text={msg.t} tone={msg.tone} />}
      <Button busy={busy} onClick={() => void doCheckIn()}><CalendarCheck size={18} />Check in today</Button>
      <Card className="grid gap-2"><h2 className="text-sm font-bold">Attendance (last 60 days): {att.data?.length ?? 0} visits</h2>
        {(att.data ?? []).slice(0, 10).map((a) => <p key={a.id} className="flex justify-between text-sm"><span>{new Date(a.checked_in_at).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span><span className="text-ink2">{new Date(a.checked_in_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</span></p>)}
        {!att.loading && !(att.data ?? []).length && <p className="text-sm text-ink2">No visits recorded yet.</p>}</Card>
      <Card className="grid gap-2"><h2 className="flex items-center gap-2 text-sm font-bold"><CreditCard size={16} />Payments</h2>
        {(pay.data ?? []).map((p) => <p key={p.id} className="flex justify-between text-sm"><span>{fmt(p.paid_at)} · {p.method.toUpperCase()}</span><b>{inr(p.amount_inr)}</b></p>)}
        {!pay.loading && !(pay.data ?? []).length && <p className="text-sm text-ink2">No payments recorded yet.</p>}
        <p className="text-xs text-ink2">Payments are recorded by the front desk. Online payment is not enabled yet.</p></Card>
      {(plans.data ?? []).length > 0 && <Card className="grid gap-2"><h2 className="text-sm font-bold">Plans</h2>{(plans.data ?? []).map((p) => <p key={p.id} className="flex justify-between text-sm"><span>{p.name} ({p.duration_days} days)</span><b>{inr(p.price_inr)}</b></p>)}</Card>}
    </div>
  )
}
