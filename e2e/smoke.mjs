// End-to-end smoke test with a mocked Supabase backend. It drives the real built app in Chromium (with software WebGL)
// through the client flow (Today's workout -> player -> rest -> summary), the muscle explorer and the trainer builder.
import { chromium } from 'playwright'
import fs from 'node:fs'

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const REF = 'zwiifeyqkeivkyssfzfu'
const OUT = 'e2e-out'
fs.mkdirSync(OUT, { recursive: true })

const ME = 'aaaaaaaa-0000-4000-8000-000000000001'
const CLIENT = 'bbbbbbbb-0000-4000-8000-000000000002'
const GYM = 'cccccccc-0000-4000-8000-000000000003'
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: ME, role: 'authenticated', exp: 4102444800 })}.sig`

const EX = [
  ['e1', 'Bench Press', 'Chest', 'Barbell', 'Intermediate', 'chest', ['front_delts', 'triceps']],
  ['e2', 'Push-up', 'Chest', 'Bodyweight', 'Beginner', 'chest', ['triceps']],
  ['e3', 'Cable Fly', 'Chest', 'Cable', 'Beginner', 'chest', ['front_delts']],
  ['e4', 'Lat Pulldown', 'Back', 'Machine', 'Beginner', 'lats', ['biceps']],
  ['e5', 'Barbell Back Squat', 'Legs', 'Barbell', 'Intermediate', 'quads', ['glutes', 'hamstrings']],
  ['e6', 'Barbell Curl', 'Arms', 'Barbell', 'Beginner', 'biceps', ['forearms']],
].map(([id, name, muscle, equipment, level, primary, sec]) => ({
  id, name, muscle, equipment, level, cue: 'Keep your core tight', primary_muscle: primary,
  instructions: ['Set up', 'Move under control', 'Return'], video_url: null,
  exercise_secondary_muscles: sec.map((m) => ({ muscle_id: m })),
}))
const planEx = (i, ex, sets, reps, w) => ({ id: `pe${i}`, exercise_id: ex.id, position: i, sets, reps, rest_sec: 30, weight_kg: w, tempo: null, rpe: null, rir: null, notes: i === 1 ? 'Slow on the way down' : null, exercises: ex })
const PLAN = [{
  name: 'Test plan',
  workout_days: [{ id: 'day1', name: 'Push day', focus: 'Chest', day_of_week: new Date().getDay(), est_minutes: 30,
    workout_exercises: [planEx(1, EX[0], 2, '8', 40), planEx(2, EX[1], 1, '10', null)] }],
}]

const calls = []
const errors = []
const results = []
const ok = (name, cond, extra = '') => { results.push({ name, ok: !!cond, extra }); console.log(cond ? 'PASS' : 'FAIL', name, extra) }

function person(role) { return { id: ME, gym_id: GYM, role, full_name: 'Test User', avatar_url: null, phone: null } }

async function setup(browser, role) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await ctx.addInitScript(([ref, token, me]) => {
    localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify({
      access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, refresh_token: 'r',
      user: { id: me, aud: 'authenticated', role: 'authenticated', email: 'test@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
    }))
  }, [REF, jwt, ME])
  await ctx.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: ME, aud: 'authenticated', email: 'test@example.com' }) }))
  await ctx.route('**/functions/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ answer: 'Nice work. Eat protein and sleep well.' }) }))
  await ctx.route('**/rest/v1/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const table = url.pathname.split('/rest/v1/')[1]
    const method = req.method()
    const single = (req.headers()['accept'] || '').includes('vnd.pgrst.object')
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    let body = null
    try { body = req.postDataJSON() } catch { /* no body */ }
    if (method !== 'GET' && method !== 'HEAD') {
      calls.push({ method, table, body })
      if (method === 'POST' || method === 'PATCH') return single ? json({ id: `mock-${table}` }) : route.fulfill({ status: 201, body: '' })
      return route.fulfill({ status: 204, body: '' })
    }
    let data = []
    const q = url.search
    if (table === 'profiles') {
      if (q.includes(`id=eq.${ME}`)) data = [person(role)]
      else if (q.includes(`id=eq.${CLIENT}`)) data = [{ id: CLIENT, full_name: 'Test Client', role: 'member', phone: null }]
      else if (q.includes('role=eq.member')) data = [{ id: CLIENT, full_name: 'Test Client', role: 'member', phone: null }]
    } else if (table === 'exercises') data = EX
    else if (table === 'workout_plans') data = PLAN
    else if (table === 'workout_templates') data = []
    if (single) return json(data[0] ?? null)
    return json(data)
  })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`) })
  return { ctx, page }
}

const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false })

async function clickChest(page) {
  const box = await page.locator('canvas').first().boundingBox()
  await page.mouse.click(box.x + box.width / 2 + 16, box.y + box.height / 2 - 78)
}

async function run() {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] })

  /* ---------- client flow ---------- */
  {
    const { ctx, page } = await setup(browser, 'member')
    await page.goto(BASE)
    await page.getByRole('button', { name: /Fitness/ }).first().click()
    await page.getByText('Today’s workout').first().waitFor({ timeout: 20000 })
    await shot(page, '01-fitness-tab')
    await page.getByRole('button', { name: /Open workout/ }).click()
    await page.getByRole('button', { name: /Start workout/ }).waitFor()
    ok('screen 5: today workout lists exercises', await page.getByText('1. Bench Press').isVisible())
    await page.waitForTimeout(1500)
    await shot(page, '02-today-workout')
    await page.getByRole('button', { name: /Start workout/ }).click()
    await page.getByRole('button', { name: /Complete set/ }).waitFor()
    ok('screen 6: player shows first exercise', await page.getByRole('heading', { name: 'Bench Press' }).isVisible())
    ok('screen 6: 3D canvas mounted', (await page.locator('canvas').count()) > 0)
    await page.waitForTimeout(1500)
    await shot(page, '03-player')
    await page.getByRole('button', { name: /Complete set/ }).click()
    await page.getByRole('button', { name: /Skip rest/ }).waitFor()
    ok('screen 7: rest timer appears after a set', true)
    await shot(page, '04-rest-timer')
    await page.getByRole('button', { name: /Add 30 seconds/ }).click()
    await page.getByRole('button', { name: /Skip rest/ }).click()
    for (let i = 0; i < 6; i++) {
      const done = page.getByRole('button', { name: /Complete set/ })
      if (!(await done.isVisible().catch(() => false))) break
      await done.click()
      const skip = page.getByRole('button', { name: /Skip rest/ })
      if (await skip.isVisible({ timeout: 1500 }).catch(() => false)) await skip.click()
    }
    ok('all sets can be completed', await page.getByText(/Exercise complete/).isVisible())
    await page.getByRole('button', { name: 'Finish', exact: true }).click()
    await page.getByRole('heading', { name: 'Workout complete' }).waitFor({ timeout: 15000 })
    await page.waitForTimeout(1500)
    await shot(page, '05-summary')
    const ses = calls.find((c) => c.table === 'workout_sessions')
    const logs = calls.find((c) => c.table === 'workout_set_logs')
    ok('session saved once with client_key', ses && ses.body && ses.body.client_key && ses.body.total_volume_kg > 0, JSON.stringify(ses?.body).slice(0, 200))
    ok('3 set logs saved with keys', logs && Array.isArray(logs.body) && logs.body.length === 3 && logs.body.every((l) => l.client_key && l.exercise_id), `n=${logs?.body?.length}`)
    await page.getByText('Muscles trained').waitFor()
    await page.getByRole('button', { name: /Ask the AI Coach/ }).click()
    await page.getByText(/Nice work/).waitFor({ timeout: 8000 })
    ok('summary: AI coach reply shown', true)
    await page.getByRole('button', { name: 'Done', exact: true }).click()

    /* explorer */
    await page.getByRole('button', { name: /Explore muscles/ }).click()
    await page.getByRole('heading', { name: 'Explore muscles' }).waitFor()
    await page.waitForTimeout(1500)
    await clickChest(page)
    let selected = await page.getByText('Selected', { exact: true }).isVisible().catch(() => false)
    if (!selected) { await page.locator('summary').click(); await page.getByRole('button', { name: 'Chest', exact: true }).click() }
    ok('screen 1: clicking the 3D chest selects Chest', selected, selected ? '' : 'fell back to list')
    await page.waitForTimeout(800)
    await shot(page, '06-muscle-selector')
    await page.getByRole('button', { name: /View exercises/ }).click()
    await page.getByText('Bench Press').first().waitFor()
    ok('screen 2: chest exercises listed', (await page.getByText('Cable Fly').count()) > 0)
    await shot(page, '07-exercise-list')
    await page.getByRole('button', { name: 'Open Bench Press' }).click()
    await page.getByText('How to do it').waitFor()
    await page.waitForTimeout(1200)
    await shot(page, '08-exercise-detail')
    ok('screen 3: detail shows muscles and steps', await page.getByText('Primary:').isVisible())
    await ctx.close()
  }

  /* ---------- trainer flow ---------- */
  {
    const { ctx, page } = await setup(browser, 'admin')
    await page.goto(BASE)
    await page.getByRole('button', { name: /Profile/ }).first().click()
    await page.getByText(/Members and gym admin|My clients/).click()
    await page.getByText('Test Client').first().click()
    await page.getByRole('button', { name: /Build workout/ }).click()
    await page.getByRole('heading', { name: 'Workout builder' }).waitFor()
    await page.getByRole('button', { name: /Add exercise/ }).click()
    await page.getByText('Add exercise').first().waitFor()
    await page.waitForTimeout(1200)
    await page.locator('summary').click()
    await page.getByRole('button', { name: 'Chest', exact: true }).click()
    await page.getByRole('button', { name: /View exercises/ }).click()
    await page.getByRole('button', { name: 'Add Bench Press' }).click()
    await page.getByRole('heading', { name: 'Configure exercise' }).waitFor()
    await page.getByRole('button', { name: 'Increase Sets' }).click()
    await page.getByRole('button', { name: 'Increase Weight' }).click()
    await shot(page, '09-configure')
    await page.getByRole('button', { name: 'Add to workout' }).click()
    await page.getByText('1. Bench Press').waitFor()
    ok('screen 4/builder: configured exercise appears in the day', await page.getByText(/4 × 10 · 2.5 kg/).isVisible())
    await shot(page, '10-builder')
    await page.getByRole('button', { name: /Assign to Test Client/ }).click()
    await page.getByRole('heading', { name: 'Workout assigned' }).waitFor({ timeout: 15000 })
    const plans = calls.filter((c) => c.table === 'workout_plans')
    const exs = calls.find((c) => c.table === 'workout_exercises')
    ok('plan created inactive then activated', plans.some((c) => c.method === 'POST' && c.body.active === false) && plans.some((c) => c.method === 'PATCH' && c.body.active === true))
    ok('exercise saved with sets/reps/weight', exs && exs.body[0].sets === 4 && exs.body[0].weight_kg === 2.5 && exs.body[0].exercise_id === 'e1', JSON.stringify(exs?.body).slice(0, 200))
    await shot(page, '11-assigned')
    await ctx.close()
  }

  await browser.close()
  const bad = errors.filter((e) => !/Failed to load resource|favicon|net::ERR/i.test(e))
  ok('no page errors or console errors', bad.length === 0, bad.slice(0, 5).join(' | ').slice(0, 600))
}

try { await run() } catch (e) {
  results.push({ name: 'test crashed', ok: false, extra: String(e && e.message || e).split('\n').slice(0, 6).join(' / ') })
  console.error(e)
}
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 1))
const failed = results.filter((r) => !r.ok)
console.log(`${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
