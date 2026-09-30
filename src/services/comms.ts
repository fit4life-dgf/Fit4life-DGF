import { supabase } from './supabase'
import type { AppNotification, Message, Profile } from '../types'

function fail(message: string): never { throw new Error(message) }

export async function fetchThread(me: string, other: string): Promise<Message[]> {
  const { data, error } = await supabase.from('messages').select('id,sender_id,recipient_id,body,read_at,created_at')
    .or(`and(sender_id.eq.${me},recipient_id.eq.${other}),and(sender_id.eq.${other},recipient_id.eq.${me})`)
    .order('created_at', { ascending: true }).limit(200)
  if (error) fail(error.message)
  return (data ?? []) as Message[]
}

export async function sendMessage(p: Profile, to: string, body: string): Promise<void> {
  const text = body.trim()
  if (!text) fail('Type a message first.')
  const { error } = await supabase.from('messages').insert({ gym_id: p.gym_id, sender_id: p.id, recipient_id: to, body: text.slice(0, 4000) })
  if (error) fail(error.message)
}

export async function markThreadRead(me: string, other: string): Promise<void> {
  await supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('recipient_id', me).eq('sender_id', other).is('read_at', null)
}

/** Latest message per conversation partner, newest first, with unread counts. */
export async function fetchInbox(me: string): Promise<{ other: string; last: Message; unread: number }[]> {
  const { data, error } = await supabase.from('messages').select('id,sender_id,recipient_id,body,read_at,created_at')
    .or(`sender_id.eq.${me},recipient_id.eq.${me}`).order('created_at', { ascending: false }).limit(300)
  if (error) fail(error.message)
  const map = new Map<string, { other: string; last: Message; unread: number }>()
  for (const m of (data ?? []) as Message[]) {
    const other = m.sender_id === me ? m.recipient_id : m.sender_id
    const cur = map.get(other) ?? { other, last: m, unread: 0 }
    if (m.recipient_id === me && !m.read_at) cur.unread++
    map.set(other, cur)
  }
  return [...map.values()]
}

export async function fetchNotifications(userId: string): Promise<AppNotification[]> {
  const { data, error } = await supabase.from('notifications').select('id,kind,title,body,read_at,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(60)
  if (error) fail(error.message)
  return (data ?? []) as AppNotification[]
}

export async function unreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('read_at', null)
  if (error) fail(error.message)
  return count ?? 0
}

export async function markAllRead(userId: string): Promise<void> {
  const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', userId).is('read_at', null)
  if (error) fail(error.message)
}

/** Sends a notification to a member (staff only; enforced by row-level security). */
export async function notify(staff: Profile, userId: string, kind: string, title: string, body: string): Promise<void> {
  const { error } = await supabase.from('notifications').insert({ user_id: userId, gym_id: staff.gym_id, kind, title, body })
  if (error) fail(error.message)
}

/** Creates the member's own reminder once per day per key (e.g. membership expiring). */
export async function selfRemind(p: Profile, key: string, title: string, body: string): Promise<void> {
  const start = new Date(); start.setHours(0, 0, 0, 0)
  const ex = await supabase.from('notifications').select('id').eq('user_id', p.id).eq('kind', key).gte('created_at', start.toISOString()).limit(1)
  if ((ex.data ?? []).length) return
  await supabase.from('notifications').insert({ user_id: p.id, gym_id: p.gym_id, kind: key, title, body })
}
