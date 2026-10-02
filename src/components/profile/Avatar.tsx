import { useEffect, useState } from 'react'
import { avatarUrl } from '../../services/avatar'

export type AvatarShape = 'round' | 'rect'
const KEY = 'f4l_avatar_shape'
export function readShape(): AvatarShape {
  try { return localStorage.getItem(KEY) === 'rect' ? 'rect' : 'round' } catch { return 'round' }
}
export function writeShape(s: AvatarShape) {
  try { localStorage.setItem(KEY, s) } catch { /* storage unavailable */ }
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?'
}

export function Avatar({ name, path, size = 44, shape = 'round', className = '' }: {
  name: string; path?: string | null; size?: number; shape?: AvatarShape; className?: string
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [bad, setBad] = useState(false)
  useEffect(() => {
    let alive = true
    setBad(false)
    if (!path) { setUrl(null); return }
    void avatarUrl(path).then((u) => { if (alive) setUrl(u) }).catch(() => { if (alive) setUrl(null) })
    return () => { alive = false }
  }, [path])
  const radius = shape === 'round' ? 'rounded-full' : 'rounded-card'
  return (
    <span data-testid="avatar" style={{ width: size, height: size }} className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden bg-accent font-extrabold text-white ${radius} ${className}`}>
      {url && !bad
        ? <img src={url} alt={`${name} profile photo`} onError={() => setBad(true)} className="h-full w-full object-cover" />
        : <span aria-hidden style={{ fontSize: size * 0.38 }}>{initials(name)}</span>}
    </span>
  )
}
