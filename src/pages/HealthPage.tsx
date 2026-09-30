import { useEffect, useRef, useState } from 'react'
import { Bluetooth, RefreshCw, Smartphone, Upload } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useNav } from '../contexts/NavContext'
import { DEFAULT_GOALS, fetchLatestVitals, importHealthCsv, logMetric, saveGoal, VITALS, type ImportResult } from '../services/health'
import { useAsync } from '../hooks/useAsync'
import { useBleHeartRate } from '../hooks/useBleHeartRate'
import { fetchGoals } from '../services/goals'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Sheet } from '../components/ui/Sheet'
import { Stepper } from '../components/ui/Stepper'
import { NumberField } from '../components/ui/NumberField'
import { ErrorBox, LoadingBlocks, Notice } from '../components/ui/StateViews'
import type { GoalTargets } from '../types'
import { connectHealth, isAuthorized, isNativeApp, lastSync, nativeStatus, platformLabel, syncNativeHealth, type SyncSummary } from '../services/nativeHealth'

const MAX_CSV_BYTES = 2 * 1024 * 1024

export function HealthPage() {
  const { profile } = useAuth()
  const nav = useNav()
  const vitals = useAsync(() => fetchLatestVitals(profile!.id), [profile?.id])
  const goals = useAsync(() => fetchGoals(profile!.id), [profile?.id])
  const ble = useBleHeartRate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [logging, setLogging] = useState<(typeof VITALS)[number] | null>(null)
  const [value, setValue] = useState(0)
  const [msg, setMsg] = useState<{ text: string; tone: 'good' | 'bad' | 'info' } | null>(null)
  const [imp, setImp] = useState<ImportResult | null>(null)
  const [editGoals, setEditGoals] = useState<GoalTargets | null>(null)
  const [busy, setBusy] = useState(false)
  const [native, setNative] = useState<{ ok: boolean; reason?: string; authorized: boolean }>({ ok: false, authorized: false })
  const [sync, setSync] = useState<SyncSummary | null>(lastSync())
  useEffect(() => {
    let alive = true
    void (async () => {
      const st = await nativeStatus()
      const authorized = st.ok ? await isAuthorized() : false
      if (alive) setNative({ ok: st.ok, reason: st.reason, authorized })
    })()
    return () => { alive = false }
  }, [])
  if (!profile) return null

  async function syncNow(connect: boolean) {
    setBusy(true); setMsg(null)
    try {
      if (connect) {
        const ok = await connectHealth()
        if (!ok.length) { setMsg({ text: `No permission was given. Open ${platformLabel()} settings and allow FIT4LIFE to read your data.`, tone: 'bad' }); return }
        setNative((n) => ({ ...n, authorized: true }))
      }
      const s = await syncNativeHealth(profile!, 14)
      setSync(s); await vitals.reload()
      const total = Object.values(s.counts).reduce((a, b) => a + b, 0)
      setMsg({ text: total ? `Synced ${total} readings.` : `Nothing new found in ${platformLabel()}. Check that your watch app writes to it.`, tone: total ? 'good' : 'info' })
    } catch (e) { setMsg({ text: e instanceof Error ? e.message : 'Sync failed.', tone: 'bad' }) } finally { setBusy(false) }
  }

  async function saveVital() {
    if (!logging) return
    setBusy(true)
    try { await logMetric(profile!, logging.metric, value, logging.unit); setLogging(null); await vitals.reload() } catch (e) { setMsg({ text: e instanceof Error ? e.message : 'Could not save.', tone: 'bad' }) } finally { setBusy(false) }
  }

  async function onFile(f: File | undefined) {
    if (!f) return
    setImp(null); setMsg(null)
    if (f.size > MAX_CSV_BYTES) { setMsg({ text: 'File is larger than 2 MB.', tone: 'bad' }); return }
    setBusy(true)
    try { setImp(await importHealthCsv(profile!, await f.text())); await vitals.reload() } catch (e) { setMsg({ text: e instanceof Error ? e.message : 'Import failed.', tone: 'bad' }) } finally { setBusy(false); if (fileRef.current) fileRef.current.value = '' }
  }

  async function saveGoals() {
    if (!editGoals) return
    setBusy(true)
    try {
      await Promise.all([saveGoal(profile!, 'steps', editGoals.steps), saveGoal(profile!, 'water_ml', editGoals.water_ml), saveGoal(profile!, 'calories', editGoals.calories), saveGoal(profile!, 'sleep_min', editGoals.sleep_min)])
      setEditGoals(null); await goals.reload(); setMsg({ text: 'Goals saved.', tone: 'good' })
    } catch (e) { setMsg({ text: e instanceof Error ? e.message : 'Could not save goals.', tone: 'bad' }) } finally { setBusy(false) }
  }

  async function saveBle() {
    if (ble.bpm == null) return
    try { await logMetric(profile!, 'heart_rate', ble.bpm, 'bpm'); setMsg({ text: `Saved ${ble.bpm} bpm.`, tone: 'good' }) } catch (e) { setMsg({ text: e instanceof Error ? e.message : 'Could not save.', tone: 'bad' }) }
  }

  return (
    <div className="grid gap-4">
      <PageHeader title="Health data" onBack={nav.back} />
      {msg && <Notice text={msg.text} tone={msg.tone} />}
      {vitals.loading ? <LoadingBlocks n={2} h="h-24" /> : vitals.error ? <ErrorBox message={vitals.error} onRetry={() => void vitals.reload()} /> : (
        <section aria-label="Vitals" className="grid grid-cols-2 gap-3">
          {VITALS.map((v) => {
            const cur = vitals.data?.[v.metric]
            return (
              <button key={v.metric} onClick={() => { setLogging(v); setValue(cur ? Math.round(cur.value) : v.def) }} className="rounded-card bg-heart/40 p-4 text-left">
                <p className="text-xs font-semibold text-ink/70">{v.label}</p>
                <p className="tabular text-2xl font-extrabold text-ink">{cur ? Math.round(cur.value) : '—'}<small className="ml-0.5 text-xs font-medium">{cur ? v.unit : ''}</small></p>
                <p className="text-[11px] text-ink/70">{cur ? new Date(cur.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Tap to log'}</p>
              </button>
            )
          })}
        </section>
      )}

      <Card className="grid gap-3">
        <h2 className="flex items-center gap-2 text-sm font-bold"><Smartphone size={16} />Phone and watch sync</h2>
        {!isNativeApp() ? <p className="text-sm text-ink2">Automatic sync runs in the FIT4LIFE mobile app. On the website you can import a CSV or log by hand.</p> :
          !native.ok ? <Notice text={native.reason ?? `${platformLabel()} is not available.`} tone="bad" /> : (
            <>
              <p className="text-sm text-ink2">Reads steps, heart rate, sleep, calories, SpO2, HRV and weight from {platformLabel()}. Your watch shows up here only if its app saves data to {platformLabel()}.</p>
              <div className="flex gap-2">
                {native.authorized ? <Button busy={busy} onClick={() => void syncNow(false)}><RefreshCw size={16} />Sync now</Button> : <Button busy={busy} onClick={() => void syncNow(true)}>Connect {platformLabel()}</Button>}
              </div>
              {sync && <div className="rounded-tile bg-card2 p-3 text-xs text-ink2">
                <p>Last sync: {new Date(sync.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</p>
                <p>Found: {Object.entries(sync.counts).map(([k, v]) => `${k} ${v}`).join(', ') || 'nothing'}</p>
                <p>From apps: {sync.sources.length ? sync.sources.join(', ') : 'none reported'}</p>
                {sync.errors.length > 0 && <p className="text-bad">Problems: {sync.errors.join('; ')}</p>}
              </div>}
            </>
          )}
      </Card>

      <Card className="grid gap-3">
        <h2 className="flex items-center gap-2 text-sm font-bold"><Bluetooth size={16} />Live heart rate</h2>
        {!ble.supported ? <p className="text-sm text-ink2">This browser cannot connect to Bluetooth sensors. Use Chrome on Android or desktop, or log heart rate by hand.</p> : (
          <>
            {ble.state === 'live' ? <p className="tabular text-4xl font-extrabold">{ble.bpm ?? '…'}<small className="ml-1 text-sm font-medium text-ink2">bpm · {ble.device}</small></p> : <p className="text-sm text-ink2">Pair a Bluetooth heart-rate strap or a band with heart-rate broadcast turned on.</p>}
            {ble.error && <Notice text={ble.error} tone="bad" />}
            <div className="flex gap-2">
              {ble.state === 'live' ? <><Button onClick={() => void saveBle()} disabled={ble.bpm == null}>Save reading</Button><Button variant="soft" onClick={ble.disconnect}>Disconnect</Button></> : <Button busy={ble.state === 'connecting'} onClick={() => void ble.connect()}>Connect sensor</Button>}
            </div>
          </>
        )}
      </Card>

      <Card className="grid gap-3">
        <h2 className="flex items-center gap-2 text-sm font-bold"><Upload size={16} />Import from your band or app</h2>
        <p className="text-sm text-ink2">Upload a CSV with the columns <code className="rounded bg-card2 px-1">metric_type,value,recorded_at</code> (optional: <code className="rounded bg-card2 px-1">unit,external_record_id</code>). Allowed metrics: steps, calories_burned, heart_rate, resting_hr, spo2, stress, respiratory_rate, hrv, weight_kg. Importing the same file twice does not create duplicates.</p>
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={(e) => void onFile(e.target.files?.[0])} className="text-sm" aria-label="Choose CSV file" disabled={busy} />
        {imp && <Notice tone={imp.errors.length && !imp.imported ? 'bad' : 'good'} text={`Imported ${imp.imported}, skipped ${imp.skipped}.${imp.errors.length ? ' ' + imp.errors.join(' ') : ''}`} />}
        <p className="text-xs text-ink2">Automatic sync from Health Connect or Apple Health runs in the mobile app, not on the website.</p>
      </Card>

      <Card className="grid gap-3">
        <h2 className="text-sm font-bold">Daily goals</h2>
        {goals.loading ? <p className="text-sm text-ink2">Loading…</p> : (
          <>
            <ul className="grid gap-1 text-sm"><li>Steps: <b>{(goals.data ?? DEFAULT_GOALS).steps.toLocaleString('en-IN')}</b></li><li>Water: <b>{(goals.data ?? DEFAULT_GOALS).water_ml} ml</b></li><li>Calories burned: <b>{(goals.data ?? DEFAULT_GOALS).calories}</b></li><li>Sleep: <b>{((goals.data ?? DEFAULT_GOALS).sleep_min / 60).toFixed(1)} h</b></li></ul>
            <Button variant="soft" onClick={() => setEditGoals(goals.data ?? DEFAULT_GOALS)}>Edit goals</Button>
          </>
        )}
      </Card>

      <Sheet open={logging != null} title={logging ? `Log ${logging.label}` : ''} onClose={() => setLogging(null)}>
        {logging && <div className="grid gap-4"><Stepper value={value} step={logging.step} min={logging.min} max={logging.max} unit={logging.unit} onChange={setValue} /><Button busy={busy} onClick={() => void saveVital()}>Save</Button></div>}
      </Sheet>
      <Sheet open={editGoals != null} title="Daily goals" onClose={() => setEditGoals(null)}>
        {editGoals && <div className="grid gap-3">
          <NumberField label="Steps" value={editGoals.steps} step={500} min={1000} max={50000} onChange={(n) => setEditGoals({ ...editGoals, steps: n })} />
          <NumberField label="Water" value={editGoals.water_ml} step={250} min={500} max={8000} unit="ml" onChange={(n) => setEditGoals({ ...editGoals, water_ml: n })} />
          <NumberField label="Calories" value={editGoals.calories} step={50} min={100} max={3000} unit="kcal" onChange={(n) => setEditGoals({ ...editGoals, calories: n })} />
          <NumberField label="Sleep" value={editGoals.sleep_min} step={15} min={240} max={720} unit="min" onChange={(n) => setEditGoals({ ...editGoals, sleep_min: n })} />
          <Button busy={busy} onClick={() => void saveGoals()}>Save goals</Button></div>}
      </Sheet>
    </div>
  )
}
