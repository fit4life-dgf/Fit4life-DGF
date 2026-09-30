import { useRef, useState } from 'react'
import { Camera, Trash2 } from 'lucide-react'
import type { Profile } from '../../types'
import { deletePhoto, fetchPhotos, uploadPhoto } from '../../services/progress'
import { useAsync } from '../../hooks/useAsync'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { ErrorBox, LoadingBlocks, Notice } from '../ui/StateViews'

export function PhotosView({ profile }: { profile: Profile }) {
  const photos = useAsync(() => fetchPhotos(profile.id), [profile.id])
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function pick(f: File | undefined) {
    if (!f) return
    setBusy(true); setErr(null)
    try { await uploadPhoto(profile, f); await photos.reload() } catch (e) { setErr(e instanceof Error ? e.message : 'Upload failed.') } finally { setBusy(false); if (ref.current) ref.current.value = '' }
  }

  return (
    <div className="grid gap-4">
      <input ref={ref} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void pick(e.target.files?.[0])} aria-label="Choose progress photo" />
      <Button busy={busy} onClick={() => ref.current?.click()}><Camera size={18} />Add progress photo</Button>
      <p className="text-xs text-ink2">Photos are private. Only you and your assigned trainer or gym admin can see them.</p>
      {err && <Notice text={err} tone="bad" />}
      {photos.loading ? <LoadingBlocks n={1} h="h-48" /> : photos.error ? <ErrorBox message={photos.error} onRetry={() => void photos.reload()} /> :
        !(photos.data ?? []).length ? <EmptyState icon={<Camera />} title="No photos yet" text="Take a front, side and back photo once a month to see your change." /> :
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">{(photos.data ?? []).map((p) => (
            <li key={p.id} className="relative overflow-hidden rounded-tile bg-card2">
              {p.url ? <img src={p.url} alt={`Progress photo from ${p.taken_on}`} loading="lazy" className="aspect-[3/4] w-full object-cover" /> : <div className="aspect-[3/4]" />}
              <span className="absolute bottom-1 left-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white">{new Date(p.taken_on + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
              <button aria-label="Delete photo" onClick={() => { if (window.confirm('Delete this photo?')) void deletePhoto(p).then(() => photos.reload()).catch((e: Error) => setErr(e.message)) }} className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white"><Trash2 size={15} /></button>
            </li>))}</ul>}
    </div>
  )
}
