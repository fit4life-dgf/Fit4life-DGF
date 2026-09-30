import { useCallback, useEffect, useRef, useState } from 'react'

/* Minimal Web Bluetooth typings (not in lib.dom). */
interface BleChar extends EventTarget { value?: DataView; startNotifications(): Promise<BleChar> }
interface BleService { getCharacteristic(id: string): Promise<BleChar> }
interface BleServer { getPrimaryService(id: string): Promise<BleService>; disconnect(): void }
interface BleDevice extends EventTarget { name?: string; gatt?: { connect(): Promise<BleServer>; connected: boolean } }
type BleNav = Navigator & { bluetooth?: { requestDevice(o: { filters: { services: string[] }[] }): Promise<BleDevice> } }

export type BleState = 'unsupported' | 'idle' | 'connecting' | 'live' | 'error'

/** Live heart rate from any Bluetooth LE heart-rate sensor (chest strap, many bands in broadcast mode). Chrome/Edge on Android and desktop only. */
export function useBleHeartRate() {
  const supported = typeof navigator !== 'undefined' && !!(navigator as BleNav).bluetooth
  const [state, setState] = useState<BleState>(supported ? 'idle' : 'unsupported')
  const [bpm, setBpm] = useState<number | null>(null)
  const [device, setDevice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const server = useRef<BleServer | null>(null)

  const connect = useCallback(async () => {
    const nav = navigator as BleNav
    if (!nav.bluetooth) return
    try {
      setState('connecting'); setError(null)
      const dev = await nav.bluetooth.requestDevice({ filters: [{ services: ['heart_rate'] }] })
      const srv = await dev.gatt!.connect()
      server.current = srv
      const svc = await srv.getPrimaryService('heart_rate')
      const ch = await svc.getCharacteristic('heart_rate_measurement')
      ch.addEventListener('characteristicvaluechanged', (e) => {
        const dv = (e.target as BleChar).value
        if (!dv) return
        const flags = dv.getUint8(0)
        setBpm(flags & 0x1 ? dv.getUint16(1, true) : dv.getUint8(1))
      })
      await ch.startNotifications()
      setDevice(dev.name ?? 'Heart-rate sensor'); setState('live')
      dev.addEventListener('gattserverdisconnected', () => { setState('idle'); setBpm(null) })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not connect.'
      setState(/cancel|chosen/i.test(msg) ? 'idle' : 'error'); setError(/cancel|chosen/i.test(msg) ? null : msg)
    }
  }, [])

  const disconnect = useCallback(() => { server.current?.disconnect(); setState('idle'); setBpm(null) }, [])
  useEffect(() => () => server.current?.disconnect(), [])
  return { supported, state, bpm, device, error, connect, disconnect }
}
