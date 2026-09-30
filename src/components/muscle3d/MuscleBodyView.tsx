import { Component, lazy, Suspense, useEffect, useRef, useState, type ErrorInfo, type PointerEvent, type ReactNode } from 'react'
import { Minus, Plus, RotateCcw } from 'lucide-react'
import type { BodyControl } from './MuscleBody3D'
import { MUSCLES, muscleName } from './muscleMap'
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
}

export function MuscleBodyView({ gender = 'male', selected = [], secondary = [], colors = {}, pulse = [], onSelect, height = 'h-[380px]', controls = true, autoFace = false, label = '3D body' }: Props) {
  const ctl = useRef<BodyControl>({ rotY: 0, targetRotY: 0, zoom: 1, targetZoom: 1 })
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const [hover, setHover] = useState<string | null>(null)
  const [ok] = useState(webglAvailable)

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
    <div className="relative">
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
              interactive={onSelect != null} ctl={ctl} onPick={(id) => onSelect?.(id)} onHover={setHover} />
          </Suspense>
        </Boundary>
        {hover && <span className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-ink px-3 py-1 text-xs font-semibold text-bg">{muscleName(hover)}</span>}
      </div>
      {controls && (
        <>
          <div className="mt-3 flex items-center justify-between gap-2">
            <div role="group" aria-label="Camera view" className="flex gap-1 rounded-full bg-card2 p-1">
              {(['front', 'back', 'left', 'right'] as ViewName[]).map((v) => (
                <button key={v} type="button" onClick={() => goView(v)} className="min-h-[36px] rounded-full px-3 text-xs font-semibold capitalize text-ink2 hover:bg-card">{v === 'left' || v === 'right' ? `${v} side` : v}</button>
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
