import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNav } from '../contexts/NavContext'
import { fetchMemberDetails, saveMemberDetails } from '../services/nutrition'
import { useAsync } from '../hooks/useAsync'
import type { MemberDetails } from '../types'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { ChoiceRow, NumberField } from '../components/ui/NumberField'
import { ErrorBox, LoadingBlocks, Notice } from '../components/ui/StateViews'

export function BodyDetailsPage() {
  const { profile } = useAuth()
  const nav = useNav()
  const cur = useAsync(() => fetchMemberDetails(profile!.id), [profile?.id])
  const [gender, setGender] = useState<MemberDetails['gender']>(null)
  const [goal, setGoal] = useState<MemberDetails['goal']>(null)
  const [activity, setActivity] = useState<MemberDetails['activity_level']>(null)
  const [age, setAge] = useState(30)
  const [height, setHeight] = useState(170)
  const [weight, setWeight] = useState(70)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ t: string; tone: 'good' | 'bad' } | null>(null)

  useEffect(() => {
    const d = cur.data
    if (!d) return
    setGender(d.gender); setGoal(d.goal); setActivity(d.activity_level)
    if (d.dob) setAge(Math.max(14, new Date().getFullYear() - new Date(d.dob).getFullYear()))
    if (d.height_cm) setHeight(Number(d.height_cm))
    if (d.weight_kg) setWeight(Number(d.weight_kg))
  }, [cur.data])

  if (!profile) return null
  async function save() {
    setBusy(true); setMsg(null)
    const y = new Date().getFullYear() - age
    try {
      await saveMemberDetails(profile!, { dob: `${y}-01-01`, gender, height_cm: height, weight_kg: weight, goal, activity_level: activity })
      setMsg({ t: 'Saved.', tone: 'good' })
    } catch (e) { setMsg({ t: e instanceof Error ? e.message : 'Could not save.', tone: 'bad' }) } finally { setBusy(false) }
  }

  return (
    <div className="grid gap-4">
      <PageHeader title="Body details" onBack={nav.back} />
      {cur.loading ? <LoadingBlocks n={2} /> : cur.error ? <ErrorBox message={cur.error} onRetry={() => void cur.reload()} /> : (
        <Card className="grid gap-4">
          <p className="text-sm text-ink2">Used to estimate your daily calorie and protein targets. Age is saved as a birth year.</p>
          <ChoiceRow<NonNullable<MemberDetails['gender']>> label="Gender" value={gender} onChange={setGender} options={[{ id: 'male', label: 'Male' }, { id: 'female', label: 'Female' }]} />
          <NumberField label="Age" value={age} step={1} min={14} max={90} unit="yr" onChange={setAge} />
          <NumberField label="Height" value={height} step={1} min={120} max={220} unit="cm" onChange={setHeight} />
          <NumberField label="Weight" value={weight} step={0.5} min={30} max={250} unit="kg" onChange={setWeight} />
          <ChoiceRow<NonNullable<MemberDetails['goal']>> label="Goal" value={goal} onChange={setGoal} options={[{ id: 'lose', label: 'Lose fat' }, { id: 'maintain', label: 'Maintain' }, { id: 'gain', label: 'Build muscle' }]} />
          <ChoiceRow<NonNullable<MemberDetails['activity_level']>> label="Activity level" value={activity} onChange={setActivity} options={[{ id: 'low', label: 'Low' }, { id: 'moderate', label: 'Moderate' }, { id: 'high', label: 'High' }]} />
          {msg && <Notice text={msg.t} tone={msg.tone} />}
          <Button busy={busy} onClick={() => void save()} disabled={!gender || !goal || !activity}>Save</Button>
        </Card>
      )}
    </div>
  )
}
