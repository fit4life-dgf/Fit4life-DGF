import { supabase } from './supabase'
import type { ChatMsg, Profile } from '../types'

function fail(message: string): never { throw new Error(message) }

export async function fetchChat(userId: string): Promise<ChatMsg[]> {
  const { data, error } = await supabase.from('ai_messages').select('role,content').eq('user_id', userId).order('created_at', { ascending: true }).limit(60)
  if (error) fail(error.message)
  return (data ?? []) as ChatMsg[]
}

export async function clearChat(userId: string): Promise<void> {
  const { error } = await supabase.from('ai_messages').delete().eq('user_id', userId)
  if (error) fail(error.message)
}

/**
 * Sends the question to the `coach` edge function, which reads the member's own data (using the member's session, so
 * row-level security applies), calls the language model with a server-side key, and stores both messages.
 */
export async function askCoach(p: Profile, question: string): Promise<string> {
  const q = question.trim()
  if (!q) fail('Ask a question first.')
  const ins = await supabase.from('ai_messages').insert({ user_id: p.id, gym_id: p.gym_id, role: 'user', content: q.slice(0, 2000) })
  if (ins.error) fail(ins.error.message)
  const { data, error } = await supabase.functions.invoke('coach', { body: { question: q.slice(0, 2000) } })
  if (error) fail('The coach is unavailable right now. Please try again.')
  const answer = (data as { answer?: string } | null)?.answer
  if (!answer) fail('The coach did not return an answer.')
  const save = await supabase.from('ai_messages').insert({ user_id: p.id, gym_id: p.gym_id, role: 'assistant', content: answer.slice(0, 8000) })
  if (save.error) fail(save.error.message)
  return answer
}
