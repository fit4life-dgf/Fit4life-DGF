import { Component, lazy, Suspense, useEffect, useRef, useState, type ErrorInfo, type PointerEvent, type ReactNode } from 'react'
import { Minus, Pause, Play, Plus, Repeat, RotateCcw, SkipBack } from 'lucide-react'
import type { AnimControl, BodyControl, ModelStatus, ViewMode } from './MuscleBody3D'
import { MUSCLES, muscleName } from './muscleMap'
import { anatomyUrl } from './meshMap'
import { Skeleton } from '../ui/Skeleton'

const Scene = lazy(() => import('./MuscleBody3D'))

export type ViewName = 'front' | 'back' | 'left' | 'right'
const ANGLE: Record<ViewName, number> = { front: 0, back: Math.PI, left: -Math.PI / 2, right: Math.PI / 2 }
const TAU = Math.PI * 2

let webgl: boolean | null = null
/** True when this browser can create a WebGL context. Cached after the first check. */
export function webglAvailable(): boolean {
  if (webgl != null) return webgl
  try {
    const c = document.createElement('canvas')
    webgl = !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch { webgl = false }
  return webgl
}

class Boundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(err: Error, info: ErrorInfo) { console.error('3D view failed', err, info.componentStack) }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

interface ChipsProps { selected: string[]; onPick?: (id: string) => void; only?: string[] }
/** Text list of muscles: the accessible alternative to the 3D body, and the fallback when WebGL is missing. */
export function MuscleChips({ selected, onPick, only }: ChipsProps) {
  const list = only ? MUSCLES.filter((m) => only.includes(m.id)) : MUSCLES
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Muscle groups">
      {list.map((m) => (
        <button key={m.id} type="button" aria-pressed={selected.includes(m.id)} disabled={!onPick} onClick={() => onPick?.(m.id)}
          className={`min-h-[40px] rounded-full px-3 text-sm font-semibold ${selected.includes(m.id) ? 'bg-accent text-white' : 'bg-card2 text-ink'}`}>{m.name}</button>
      ))}
    </div>
  )
}

interface Props {
  gender?: 'male' | 'female'
  selected?: string[]
  secondary?: string[]
  colors?: Record<string, string>
  pulse?: string[]
  onSelect?: (id: string) => void
  height?: string
  controls?: boolean
  autoFace?: boolean
  label?: string
  /** An exercise-specific .glb (body + animation clips). Falls back to the anatomy model, then to the placeholder body. */
  modelUrl?: string | null
  /** Name of the animation clip to play; defaults to the first clip in the model. */
  clip?: string | null
  /** Show the Muscle / Skin / Skeleton switch. */
  viewModes?: boolean
  /** Show playback controls (play, pause, restart, scrub, speed, loop). */
  animation?: boolean
}

const SPEEDS = [0.25, 0.5, 1, 1.5, 2]
const fmt = (t: number) => `${t.toFixed(1)}s`

function AnimBar({ anim, clips }: { anim: { current: AnimControl }; clips: string[] }) {
  const [, tick] = useState(0)
  useEffect(() => {
    if (!clips.length) return
    const id = window.setInterval(() => tick((n) => n + 1), 100)
    return () => window.clearInterval(id)
  }, [clips.length])
  if (!clips.length) {
    return <p className="rounded-card bg-card2 px-3 py-2 text-xs text-ink2">No movement animation is installed for this exercise yet. Add a clip to the 3D model to enable playback.</p>
  }
  const a = anim.current
  return (
    <div className="grid gap-2 rounded-card bg-card2 p-3" role="group" aria-label="Exercise animation">
      <div className="flex items-center gap-2">
        <button type="button" aria-label={a.playing ? 'Pause' : 'Play'} onClick={() => { if (!a.playing && !a.loop && a.time >= a.duration - 1e-3) a.restart = true; a.playing = !a.playing; tick((n) => n + 1) }}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-white">{a.playing ? <Pause size={18} /> : <Play size={18} />}</button>
        <button type="button" aria-label="Restart" onClick={() => { a.restart = true; a.playing = true; tick((n) => n + 1) }} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card"><SkipBack size={16} /></button>
        <input type="range" aria-label="Animation timeline" min={0} max={Math.max(a.duration, 0.01)} step={0.01} value={Math.min(a.time, a.duration)}
          onChange={(e) => { a.seek = Number(e.target.value); a.playing = false; tick((n) => n + 1) }} className="min-w-0 flex-1 accent-accent" />
        <span className="w-20 shrink-0 text-right text-xs tabular-nums text-ink2">{fmt(a.time)} / {fmt(a.duration)}</span>
        <button type="button" aria-label="Loop" aria-pressed={a.loop} onClick={() => { a.loop = !a.loop; tick((n) => n + 1) }}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${a.loop ? 'bg-accent text-white' : 'bg-card'}`}><Repeat size={16} /></button>
      </div>
      <div role="group" aria-label="Playback speed" className="flex gap-1">
        {SPEEDS.map((sp) => (
          <button key={sp} type="button" aria-pressed={a.speed === sp} onClick={() => { a.speed = sp; tick((n) => n + 1) }}
            className={`min-h-[36px] flex-1 rounded-full text-xs font-semibold ${a.speed === sp ? 'bg-accent text-white' : 'bg-card text-ink2'}`}>{sp}x</button>
        ))}
      </div>
    </div>
  )
}

export function MuscleBodyView({ gender = 'male', selected = [], secondary = [], colors = {}, pulse = [], onSelect, height = 'h-[380px]', controls = true, autoFace = false, label = '3D body', modelUrl = null, clip = null, viewModes = false, animation = false }: Props) {
  const ctl = useRef<BodyControl>({ rotY: 0, targetRotY: 0, zoom: 1, targetZoom: 1 })
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const [hover, setHover] = useState<string | null>(null)
  const [ok] = useState(webglAvailable)
  const anim = useRef<AnimControl>({ playing: true, speed: 1, loop: true, seek: null, restart: false, time: 0, duration: 0 })
  const [status, setStatus] = useState<ModelStatus>({ state: 'loading', progress: 0, clips: [], hasSkin: false, hasSkeleton: false })
  const [view, setView] = useState<ViewMode>('muscle')

  const goView = (v: ViewName) => {
    const base = ANGLE[v]
    ctl.current.targetRotY = base + TAU * Math.round((ctl.current.rotY - base) / TAU)
  }
  const zoomBy = (f: number) => { ctl.current.targetZoom = Math.min(2.2, Math.max(0.7, ctl.current.targetZoom * f)) }
  const reset = () => { goView('front'); ctl.current.targetZoom = 1 }

  const first = selected[0]
  useEffect(() => {
    if (!autoFace || !first) return
    const meta = MUSCLES.find((m) => m.id === first)
    if (meta?.side === 'back') goView('back')
    else if (meta?.side === 'front') goView('front')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [first, autoFace])

  const down = (e: PointerEvent<HTMLDivElement>) => { pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY }) }
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const prev = pointers.current.get(e.pointerId)
    if (!prev) return
    const cur = { x: e.clientX, y: e.clientY }
    if (pointers.current.size === 1) {
      ctl.current.targetRotY += (cur.x - prev.x) * 0.012
    } else {
      const other = [...pointers.current.entries()].find(([id]) => id !== e.pointerId)?.[1]
      if (other) {
        const d0 = Math.hypot(prev.x - other.x, prev.y - other.y)
        const d1 = Math.hypot(cur.x - other.x, cur.y - other.y)
        if (d0 > 10) zoomBy(d1 / d0)
      }
    }
    pointers.current.set(e.pointerId, cur)
  }
  const up = (e: PointerEvent<HTMLDivElement>) => { pointers.current.delete(e.pointerId) }

  const fallback = (
    <div className="grid gap-3 rounded-card bg-card2 p-4">
      <p className="text-sm text-ink2">The 3D body could not start on this device, so choose a muscle from the list instead.</p>
      <MuscleChips selected={selected} onPick={onSelect} />
    </div>
  )
  if (!ok) return fallback

  return (
    <div className="relative min-w-0">
      <div
        role="group" aria-label={`${label}. Drag to rotate, tap a muscle to select it.`} tabIndex={0}
        className={`relative w-full overflow-hidden rounded-card bg-card2 ${height} cursor-grab touch-pan-y select-none outline-none focus-visible:ring-2 focus-visible:ring-accent active:cursor-grabbing`}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') ctl.current.targetRotY -= 0.4
          else if (e.key === 'ArrowRight') ctl.current.targetRotY += 0.4
          else if (e.key === '+' || e.key === '=') zoomBy(1.15)
          else if (e.key === '-') zoomBy(1 / 1.15)
        }}
      >
        <Boundary fallback={fallback}>
          <Suspense fallback={<Skeleton className="h-full w-full" />}>
            <Scene gender={gender} selected={selected} secondary={secondary} colors={colors} pulse={pulse}
              interactive={onSelect != null} ctl={ctl} onPick={(id) => onSelect?.(id)} onHover={setHover}
              modelUrl={modelUrl} fallbackUrl={anatomyUrl(gender)} view={view} clip={clip} anim={anim} onStatus={setStatus} />
          </Suspense>
        </Boundary>
        {status.state === 'loading' && (
          <div className="pointer-events-none absolute inset-x-6 bottom-4" role="progressbar" aria-label="Loading 3D model" aria-valuenow={Math.round(status.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-1.5 overflow-hidden rounded-full bg-card"><div className="h-full bg-accent transition-all" style={{ width: `${Math.max(8, status.progress * 100)}%` }} /></div>
          </div>
        )}
        {status.state === 'placeholder' && <span className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-card px-2.5 py-1 text-[10px] font-semibold text-ink2">Placeholder body: licensed 3D model not installed</span>}
        {hover && <span className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-ink px-3 py-1 text-xs font-semibold text-bg">{muscleName(hover)}</span>}
      </div>
      {viewModes && (
        <div role="group" aria-label="Anatomy layer" className="mt-3 flex gap-0.5 rounded-full bg-card2 p-1">
          {([['muscle', 'Muscle', true], ['skin', 'Skin', status.hasSkin], ['skeleton', 'Skeleton', status.hasSkeleton]] as [ViewMode, string, boolean][]).map(([v, name, on]) => (
            <button key={v} type="button" disabled={!on} aria-pressed={view === v} title={on ? undefined : `No ${v} layer in the installed model`} onClick={() => setView(v)}
              className={`min-h-[36px] flex-1 rounded-full text-xs font-semibold disabled:opacity-40 ${view === v ? 'bg-accent text-white' : 'text-ink2'}`}>{name}</button>
          ))}
        </div>
      )}
      {animation && <div className="mt-3"><AnimBar anim={anim} clips={status.clips} /></div>}
      {controls && (
        <>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div role="group" aria-label="Camera view" className="flex gap-0.5 rounded-full bg-card2 p-1">
              {(['front', 'back', 'left', 'right'] as ViewName[]).map((v) => (
                <button key={v} type="button" onClick={() => goView(v)} className="min-h-[36px] rounded-full px-2.5 text-xs font-semibold capitalize text-ink2 hover:bg-card" aria-label={v === 'left' || v === 'right' ? `${v} side view` : `${v} view`}>{v}</button>
              ))}
            </div>
            <div className="flex gap-1">
              <button type="button" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.2)} className="flex h-10 w-10 items-center justify-center rounded-full bg-card2"><Minus size={16} /></button>
              <button type="button" aria-label="Zoom in" onClick={() => zoomBy(1.2)} className="flex h-10 w-10 items-center justify-center rounded-full bg-card2"><Plus size={16} /></button>
              <button type="button" aria-label="Reset view" onClick={reset} className="flex h-10 w-10 items-center justify-center rounded-full bg-card2"><RotateCcw size={16} /></button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
