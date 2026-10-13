import { Component, lazy, Suspense, useMemo, useRef, useState, type ErrorInfo, type PointerEvent, type ReactNode } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { equipFor, motionFor } from './motions'
import { segmentColors } from './segments'
import type { DemoControl } from './DemoScene'
import { webglAvailable } from '../muscle3d/MuscleBodyView'
import { Skeleton } from '../ui/Skeleton'

const Scene = lazy(() => import('./DemoScene'))

class Boundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(err: Error, info: ErrorInfo) { console.error('Exercise demo failed', err, info.componentStack) }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

const SPEEDS = [0.25, 0.5, 1, 1.5]
const VIEWS: { id: string; label: string; yaw: number }[] = [
  { id: 'angle', label: 'Angle', yaw: -0.6 }, { id: 'side', label: 'Side', yaw: 0 }, { id: 'front', label: 'Front', yaw: -Math.PI / 2 },
]

/** True when the animated demo can show this exercise. */
export const hasDemo = (name: string) => motionFor(name) != null

interface Props { name: string; equipment?: string | null; primary: string[]; secondary: string[]; stabilizers: string[]; height?: string }

/** Animated 3D figure performing the exercise. Drawn in code, so no model file is needed. */
export function ExerciseDemo({ name, equipment, primary, secondary, stabilizers, height = 'h-[320px]' }: Props) {
  const motion = motionFor(name)
  const roleKey = [primary.join(), secondary.join(), stabilizers.join()].join('|')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const colors = useMemo(() => segmentColors(primary, secondary, stabilizers), [roleKey])
  const ctl = useRef<DemoControl>({ playing: true, speed: 1, t: 0, yaw: -0.6, targetYaw: -0.6, restart: false })
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [view, setView] = useState('angle')
  const drag = useRef<number | null>(null)
  if (!motion) return null

  const text = <p className="rounded-card bg-card2 p-3 text-sm">{motion.describe}</p>
  if (!webglAvailable()) return text
  const toggle = () => { ctl.current.playing = !ctl.current.playing; setPlaying(ctl.current.playing) }
  const onDown = (e: PointerEvent) => { drag.current = e.clientX; (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId) }
  const onMove = (e: PointerEvent) => {
    if (drag.current == null) return
    ctl.current.targetYaw += (e.clientX - drag.current) * 0.012
    drag.current = e.clientX
    setView('')
  }
  const onUp = () => { drag.current = null }

  return (
    <div className="grid gap-2" data-testid="exercise-demo">
      <div className={`relative w-full overflow-hidden rounded-card bg-card2 ${height}`} style={{ touchAction: 'pan-y' }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} role="img" aria-label={`3D demonstration of ${name}. ${motion.describe}`}>
        <Boundary fallback={<div className="p-4 text-sm text-ink2">The 3D demo could not start on this device.</div>}>
          <Suspense fallback={<Skeleton className="h-full w-full" />}>
            <Scene motion={motion} colors={colors} equip={equipFor(equipment)} ctl={ctl} />
          </Suspense>
        </Boundary>
        <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-bg/70 px-2 py-0.5 text-[11px] font-semibold">{motion.label}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" aria-label={playing ? 'Pause demo' : 'Play demo'} onClick={toggle} className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white">{playing ? <Pause size={18} /> : <Play size={18} />}</button>
        <button type="button" aria-label="Restart demo" onClick={() => { ctl.current.restart = true }} className="flex h-10 w-10 items-center justify-center rounded-full bg-card2"><RotateCcw size={16} /></button>
        <div role="group" aria-label="Demo speed" className="flex gap-1">
          {SPEEDS.map((s) => <button key={s} type="button" aria-pressed={speed === s} onClick={() => { ctl.current.speed = s; setSpeed(s) }} className={`min-h-[36px] rounded-full px-2.5 text-xs font-semibold ${speed === s ? 'bg-accent text-white' : 'bg-card2'}`}>{s}x</button>)}
        </div>
        <div role="group" aria-label="Demo view" className="ml-auto flex gap-1">
          {VIEWS.map((v) => <button key={v.id} type="button" aria-pressed={view === v.id} onClick={() => { ctl.current.targetYaw = v.yaw; setView(v.id) }} className={`min-h-[36px] rounded-full px-2.5 text-xs font-semibold ${view === v.id ? 'bg-accent text-white' : 'bg-card2'}`}>{v.label}</button>)}
        </div>
      </div>
      <p className="text-xs text-ink2">{motion.describe} A simplified figure that shows the movement; coloured parts show the muscles worked. Drag to turn it.</p>
    </div>
  )
}
