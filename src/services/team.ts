import { supabase } from './supabase'
import type { AppRole, PersonRow, Profile } from '../types'

function fail(message: string): never { throw new Error(message) }

/** Clients of the signed-in trainer (or every member for admin/owner). */
export async function fetchClients(profile: Profile): Promise<PersonRow[]> {
  if (profile.role === 'trainer') {
    const { data, error } = await supabase.from('trainer_clients')
      .select('members(user_id),trainers!inner(user_id)').eq('active', true).eq('trainers.user_id', profile.id)
    if (error) fail(error.message)
    const ids = ((data ?? []) as unknown as { members: { user_id: string } | null }[]).map((r) => r.members?.user_id).filter((x): x is string => !!x)
    if (!ids.length) return []
    const p = await supabase.from('profiles').select('id,full_name,role,phone').in('id', ids).order('full_name')
    if (p.error) fail(p.error.message)
    return (p.data ?? []) as PersonRow[]
  }
  const { data, error } = await supabase.from('profiles').select('id,full_name,role,phone').eq('role', 'member').order('full_name')
  if (error) fail(error.message)
  return (data ?? []) as PersonRow[]
}

export async function fetchPeople(): Promise<PersonRow[]> {
  const { data, error } = await supabase.from('profiles').select('id,full_name,role,phone').order('full_name')
  if (error) fail(error.message)
  return (data ?? []) as PersonRow[]
}

export async function fetchProfileById(id: string): Promise<PersonRow | null> {
  const { data, error } = await supabase.from('profiles').select('id,full_name,role,phone').eq('id', id).maybeSingle()
  if (error) fail(error.message)
  return (data as PersonRow | null) ?? null
}

/** The signed-in member's assigned trainer, if any. */
export async function fetchMyTrainer(userId: string): Promise<PersonRow | null> {
  const { data, error } = await supabase.from('trainer_clients')
    .select('trainers(user_id),members!inner(user_id)').eq('active', true).eq('members.user_id', userId).limit(1)
  if (error) fail(error.message)
  const tid = ((data ?? []) as unknown as { trainers: { user_id: string } | null }[])[0]?.trainers?.user_id
  return tid ? fetchProfileById(tid) : null
}

export async function assignRole(target: string, role: AppRole): Promise<void> {
  const { error } = await supabase.rpc('assign_role', { target, new_role: role })
  if (error) fail(error.message)
}
export async function assignClient(member: string, trainer: string): Promise<void> {
  const { error } = await supabase.rpc('assign_client', { member_user: member, trainer_user: trainer })
  if (error) fail(error.message)
}
