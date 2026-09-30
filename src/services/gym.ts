import { supabase } from './supabase'
import type { AttendanceRow, Membership, MembershipPlan, Payment, Profile } from '../types'
import { localISODate } from '../utils/dates'

function fail(message: string): never { throw new Error(message) }

export async function fetchPlans(): Promise<MembershipPlan[]> {
  const { data, error } = await supabase.from('membership_plans').select('id,name,price_inr,duration_days,active').eq('active', true).order('duration_days')
  if (error) fail(error.message)
  return (data ?? []) as MembershipPlan[]
}

export async function fetchMembership(userId: string): Promise<Membership | null> {
  const { data, error } = await supabase.from('memberships').select('id,plan_id,starts_on,ends_on,status').eq('user_id', userId).order('ends_on', { ascending: false }).limit(1)
  if (error) fail(error.message)
  return ((data ?? [])[0] ?? null) as Membership | null
}

export function daysLeft(m: Membership | null, now: Date = new Date()): number | null {
  if (!m) return null
  const end = new Date(m.ends_on + 'T23:59:59')
  return Math.ceil((end.getTime() - now.getTime()) / 864e5)
}

export async function fetchPayments(userId: string): Promise<Payment[]> {
  const { data, error } = await supabase.from('payments').select('id,amount_inr,method,status,reference,paid_at,user_id').eq('user_id', userId).order('paid_at', { ascending: false }).limit(50)
  if (error) fail(error.message)
  return (data ?? []) as Payment[]
}

export async function fetchAttendance(userId: string, days = 60): Promise<AttendanceRow[]> {
  const since = new Date(Date.now() - days * 864e5).toISOString()
  const { data, error } = await supabase.from('attendance').select('id,checked_in_at,method,user_id').eq('user_id', userId).gte('checked_in_at', since).order('checked_in_at', { ascending: false })
  if (error) fail(error.message)
  return (data ?? []) as AttendanceRow[]
}

/** One self check-in per calendar day. */
export async function checkIn(p: Profile): Promise<'ok' | 'already'> {
  const start = new Date(); start.setHours(0, 0, 0, 0)
  const ex = await supabase.from('attendance').select('id').eq('user_id', p.id).gte('checked_in_at', start.toISOString()).limit(1)
  if (ex.error) fail(ex.error.message)
  if ((ex.data ?? []).length) return 'already'
  const { error } = await supabase.from('attendance').insert({ user_id: p.id, gym_id: p.gym_id, method: 'self' })
  if (error) fail(error.message)
  return 'ok'
}

/** Admin: record a payment and extend (or start) the membership for the chosen plan. */
export async function recordPayment(admin: Profile, memberId: string, plan: MembershipPlan, method: string, reference: string): Promise<void> {
  const current = await fetchMembership(memberId)
  const today = localISODate()
  const base = current && current.ends_on >= today ? current.ends_on : today
  const end = new Date(base + 'T00:00:00'); end.setDate(end.getDate() + plan.duration_days)
  const ms = await supabase.from('memberships').insert({ user_id: memberId, gym_id: admin.gym_id, plan_id: plan.id, starts_on: base, ends_on: localISODate(end), status: 'active' }).select('id').single()
  if (ms.error || !ms.data) fail(ms.error?.message ?? 'Could not create membership')
  const pay = await supabase.from('payments').insert({
    user_id: memberId, gym_id: admin.gym_id, membership_id: (ms.data as { id: string }).id, amount_inr: plan.price_inr, method, status: 'paid', reference: reference || null, created_by: admin.id,
  })
  if (pay.error) fail(pay.error.message)
  await supabase.from('notifications').insert({ user_id: memberId, gym_id: admin.gym_id, kind: 'payment', title: 'Payment received', body: `${plan.name} plan active until ${localISODate(end)}` })
}

export async function fetchGymAttendanceToday(): Promise<number> {
  const start = new Date(); start.setHours(0, 0, 0, 0)
  const { count, error } = await supabase.from('attendance').select('id', { count: 'exact', head: true }).gte('checked_in_at', start.toISOString())
  if (error) fail(error.message)
  return count ?? 0
}

export async function fetchExpiring(days = 7): Promise<{ user_id: string; ends_on: string }[]> {
  const limit = new Date(); limit.setDate(limit.getDate() + days)
  const { data, error } = await supabase.from('memberships').select('user_id,ends_on').eq('status', 'active').lte('ends_on', localISODate(limit)).order('ends_on')
  if (error) fail(error.message)
  const seen = new Set<string>(); const out: { user_id: string; ends_on: string }[] = []
  for (const r of (data ?? []) as { user_id: string; ends_on: string }[]) if (!seen.has(r.user_id)) { seen.add(r.user_id); out.push(r) }
  return out
}
