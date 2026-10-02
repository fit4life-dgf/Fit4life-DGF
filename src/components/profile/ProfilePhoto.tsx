import { useRef, useState } from 'react'
import { Camera, Trash2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../ui/Button'
import { Avatar, readShape, writeShape, type AvatarShape } from './Avatar'
import { removeAvatar, uploadAvatar } from '../../services/avatar'

export function ProfilePhoto() {
  const { profile, refreshProfile } = useAuth()
  const input = useRef<HTMLInputElement>(null)
  const [shape, setShape] = useState<AvatarShape>(readShape)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  if (!profile) return null

  async function pick(f: File | undefined) {
    if (!f || !profile) return
    setMsg(null)
    const local = URL.createObjectURL(f)
    setPreview(local)
    setBusy(true)
    try {
      await uploadAvatar(profile, f)
      await refreshProfile()
      setMsg({ ok: true, text: 'Profile photo updated.' })
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Upload failed.' })
    } finally {
      setBusy(false)
      setPreview(null)
      URL.revokeObjectURL(local)
      if (input.current) input.current.value = ''
    }
  }
  async function remove() {
    if (!profile) return
    setBusy(true); setMsg(null)
    try { await removeAvatar(profile); await refreshProfile(); setMsg({ ok: true, text: 'Photo removed.' }) }
    catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not remove the photo.' }) }
    finally { setBusy(false) }
  }
  const choose = (s: AvatarShape) => { setShape(s); writeShape(s) }

  return (
    <div className="flex items-center gap-4">
      <Avatar name={profile.full_name} path={preview ?? profile.avatar_url} size={88} shape={shape} />
      <div className="grid min-w-0 flex-1 gap-2">
        <p className="truncate text-lg font-bold">{profile.full_name}</p>
        <input ref={input} type="file" accept="image/*" aria-label="Choose profile photo" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} />
        <div className="flex flex-wrap gap-2">
          <Button variant="soft" busy={busy} onClick={() => input.current?.click()}><Camera size={16} />{profile.avatar_url ? 'Change photo' : 'Upload photo'}</Button>
          {profile.avatar_url && <Button variant="ghost" busy={busy} onClick={() => void remove()} aria-label="Remove photo"><Trash2 size={16} /></Button>}
        </div>
        <div role="radiogroup" aria-label="Photo shape" className="flex gap-2">
          {(['round', 'rect'] as AvatarShape[]).map((s) => (
            <button key={s} role="radio" aria-checked={shape === s} onClick={() => choose(s)} className={`min-h-[36px] rounded-tile px-3 text-xs font-semibold ${shape === s ? 'bg-accent text-white' : 'bg-card2 text-ink'}`}>{s === 'round' ? 'Round' : 'Rectangle'}</button>
          ))}
        </div>
        {msg && <p role={msg.ok ? 'status' : 'alert'} className={`text-xs ${msg.ok ? 'text-good' : 'text-bad'}`}>{msg.text}</p>}
      </div>
    </div>
  )
}
