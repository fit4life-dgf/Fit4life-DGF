import { supabase } from './supabase'
import type { Profile } from '../types'

const BUCKET = 'fit-photos'
const MAX_BYTES = 8 * 1024 * 1024
const SIZE = 512
const urlCache = new Map<string, { url: string; at: number }>()

/** Centre-crop to a square and downscale, so every avatar is small and fits both round and rectangular frames. */
export async function prepareAvatar(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.')
  if (file.size > MAX_BYTES) throw new Error('Image is larger than 8 MB.')
  const bmp = await createImageBitmap(file).catch(() => null)
  if (!bmp) throw new Error('That image could not be read. Try a JPG or PNG.')
  const side = Math.min(bmp.width, bmp.height)
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const g = canvas.getContext('2d')
  if (!g) throw new Error('Image processing is not available on this device.')
  g.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, SIZE, SIZE)
  bmp.close()
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.86))
  if (!blob) throw new Error('Could not process the image.')
  return blob
}

export async function uploadAvatar(p: Profile, file: File): Promise<string> {
  const blob = await prepareAvatar(file)
  const path = `${p.id}/avatar-${Date.now()}.jpg`
  const up = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' })
  if (up.error) throw new Error(up.error.message)
  const { error } = await supabase.from('profiles').update({ avatar_url: path }).eq('id', p.id)
  if (error) {
    await supabase.storage.from(BUCKET).remove([path])
    throw new Error(error.message)
  }
  if (p.avatar_url && p.avatar_url !== path) await supabase.storage.from(BUCKET).remove([p.avatar_url])
  urlCache.delete(path)
  return path
}

export async function removeAvatar(p: Profile): Promise<void> {
  const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', p.id)
  if (error) throw new Error(error.message)
  if (p.avatar_url) await supabase.storage.from(BUCKET).remove([p.avatar_url])
}

export async function avatarUrl(path: string): Promise<string | null> {
  if (/^https?:|^blob:|^data:/.test(path)) return path
  const hit = urlCache.get(path)
  if (hit && Date.now() - hit.at < 50 * 60 * 1000) return hit.url
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600)
  if (error || !data) return null
  urlCache.set(path, { url: data.signedUrl, at: Date.now() })
  return data.signedUrl
}
