import { useEffect, useRef, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { ProgressRing } from '../../components/ui/ProgressRing'
import { Button } from '../../components/ui/Button'
import { mmss } from './common'

interface Props { seconds: number; next: string; detail: string; onDone: () => void }

/** Screen 7: large circular timer with plus/minus 30 seconds. Uses timestamps so it stays correct if the tab sleeps. */
export function RestTimer({ seconds, next, detail, onDone }: Props) {
  const [endAt, setEndAt] = useState(() => Date.now() + seconds * 1000)
  const [total, setTotal] = useState(Math.max(1, seconds))
  const [now, setNow] = useState(Date.now())
  const fired = useRef(false)
  const left = Math.max(0, Math.ceil((endAt - now) / 1000))

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    if (left > 0 || fired.current) return
    fired.current = true
    try { navigator.vibrate?.([200, 100, 200]) } catch { /* vibration not supported */ }
    onDone()
  }, [left, onDone])

  const adjust = (delta: number) => {
    const remaining = Math.max(0, endAt - Date.now())
    const nextRemaining = Math.max(5000, remaining + delta * 1000)
    setEndAt(Date.now() + nextRemaining)
    setTotal((t) => Math.max(t, Math.ceil(nextRemaining / 1000)))
    setNow(Date.now())
  }

  return (
    <div className="grid justify-items-center gap-5 py-4 text-center" role="timer" aria-live="off" aria-label={`Rest, ${mmss(left)} remaining`}>
      <h1 className="text-2xl font-extrabold">Rest</h1>
      <ProgressRing value={(left / total) * 100} size={240} stroke={14} color="workout" label={`${mmss(left)} of rest remaining`}>
        <span className="tabular text-6xl font-extrabold">{mmss(left)}</span>
        <span className="text-xs font-semibold text-ink2">remaining</span>
      </ProgressRing>
      <div className="flex items-center gap-3">
        <Button variant="soft" onClick={() => adjust(-30)} aria-label="Subtract 30 seconds"><Minus size={16} />30 s</Button>
        <Button variant="soft" onClick={() => adjust(30)} aria-label="Add 30 seconds"><Plus size={16} />30 s</Button>
      </div>
      <div className="w-full max-w-sm rounded-card border border-line bg-card p-4 text-left shadow-card">
        <p className="text-xs font-semibold text-ink2">Up next</p>
        <p className="font-bold">{next}</p>
        <p className="text-sm text-ink2">{detail}</p>
      </div>
      <Button className="w-full max-w-sm" onClick={() => { fired.current = true; onDone() }}>Skip rest</Button>
    </div>
  )
}
