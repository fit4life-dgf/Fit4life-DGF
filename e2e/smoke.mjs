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
  ['e1', 'Bench Press', 'Chest', 'Barbell', 'Intermediate', 'chest', ['front_delts', 'triceps', 'serratus']],
  ['e2', 'Push-up', 'Chest', 'Bodyweight', 'Beginner', 'chest', ['triceps']],
  ['e3', 'Cable Fly', 'Chest', 'Cable', 'Beginner', 'chest', ['front_delts']],
  ['e4', 'Lat Pulldown', 'Back', 'Machine', 'Beginner', 'lats', ['biceps']],
  ['e5', 'Barbell Back Squat', 'Legs', 'Barbell', 'Intermediate', 'quads', ['glutes', 'hamstrings']],
  ['e6', 'Barbell Curl', 'Arms', 'Barbell', 'Beginner', 'biceps', ['forearms']],
].map(([id, name, muscle, equipment, level, primary, sec]) => ({
  id, name, muscle, equipment, level, cue: 'Keep your core tight', primary_muscle: primary,
  instructions: ['Set up', 'Move under control', 'Return'], video_url: null,
  exercise_secondary_muscles: sec.map((m) => ({ muscle_id: m, role: m === 'serratus' ? 'stabilizer' : 'secondary' })),
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

async function setup(browser, role, viewport = { width: 390, height: 844 }) {
  const ctx = await browser.newContext({ viewport })
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
    else if (table === 'training_goals') data = [{ id: 'hypertrophy', name: 'Hypertrophy' }, { id: 'strength', name: 'Strength' }, { id: 'endurance', name: 'Muscular endurance' }, { id: 'beginner', name: 'Beginner / general fitness' }]
    else if (table === 'exercise_goal_prescriptions') {
      data = q.includes('exercise_id=eq.e1') ? [
        { exercise_id: 'e1', goal_id: 'hypertrophy', sets_min: 3, sets_max: 4, reps_min: 6, reps_max: 12, rest_min_seconds: 90, rest_max_seconds: 150, tempo: null },
        { exercise_id: 'e1', goal_id: 'strength', sets_min: 3, sets_max: 5, reps_min: 3, reps_max: 6, rest_min_seconds: 180, rest_max_seconds: 300, tempo: null },
      ] : []
    }
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
    await page.getByRole('button', { name: 'Details for Bench Press' }).click()
    await page.getByRole('heading', { name: 'Muscles involved' }).waitFor()
    ok('priority: trainer-assigned values are shown and labelled', (await page.getByText('From your trainer').count()) >= 3 && await page.getByText('2', { exact: true }).first().isVisible() && (await page.getByText('Not prescribed').count()) >= 1)
    await page.getByRole('button', { name: 'Back' }).first().click()
    await page.getByRole('button', { name: /Start workout/ }).waitFor()
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
    await page.getByRole('heading', { name: 'Muscles involved' }).waitFor()
    await page.waitForTimeout(1500)
    await shot(page, '08-exercise-detail')
    ok('screen 3: detail shows role legend and lists', (await page.getByText('Stabilizers').count()) > 0 && await page.getByLabel('Colour key').isVisible())
    ok('screen 3: tabs switch', await (async () => { await page.getByRole('tab', { name: 'Instructions' }).click(); await page.getByRole('tab', { name: 'Breathing' }).click(); return await page.getByText('Breathing guidance has not been added').isVisible() })())
    await page.getByRole('tab', { name: 'Overview' }).click()
    ok('priority: goal default shown and labelled for a library exercise', (await page.getByText('3-4', { exact: true }).first().isVisible()) && (await page.getByText('Goal default').count()) >= 3)
    await page.getByLabel('Training goal').selectOption('strength')
    ok('goal selector switches the default', await page.getByText('3-6', { exact: true }).first().isVisible())
    await page.getByLabel('Training goal').selectOption('hypertrophy')
    ok('clients cannot edit goal defaults', (await page.getByRole('button', { name: /Edit .* default/ }).count()) === 0)
    ok('3d: placeholder shown and layer/animation controls degrade', await page.getByText(/3D anatomy asset not installed/).isVisible() && await page.getByRole('button', { name: 'Skin', exact: true }).isDisabled() && await page.getByText(/No movement animation/).isVisible())
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
    await page.getByRole('button', { name: 'Open Bench Press' }).click()
    await page.getByRole('heading', { name: 'Muscles involved' }).waitFor()
    await page.getByRole('button', { name: /Edit Hypertrophy default/ }).click()
    await page.getByRole('button', { name: 'Increase Sets min' }).click()
    await page.getByRole('button', { name: 'Save default' }).click()
    await page.waitForTimeout(800)
    const egp = calls.find((c) => c.table === 'exercise_goal_prescriptions')
    ok('trainer can save a goal default', egp && egp.method === 'POST' && egp.body.sets_min === 4 && egp.body.goal_id === 'hypertrophy' && egp.body.exercise_id === 'e1', JSON.stringify(egp?.body))
    await page.getByRole('button', { name: 'Back' }).first().click()
    await page.getByRole('button', { name: 'Add Bench Press' }).click()
    await page.getByRole('heading', { name: 'Configure exercise' }).waitFor()
    await page.waitForTimeout(500)
    ok('builder prefills from the goal default', await page.getByText(/Prefilled from the Hypertrophy default: 3-4 sets, 6-12 reps, 90-150 sec rest/).isVisible())
    await page.getByRole('button', { name: 'Increase Sets' }).click()
    await page.getByRole('button', { name: 'Increase Weight' }).click()
    await shot(page, '09-configure')
    await page.getByRole('button', { name: 'Add to workout' }).click()
    await page.getByText('1. Bench Press').waitFor()
    ok('screen 4/builder: configured exercise appears in the day', await page.getByText(/4 × 9 · 2.5 kg/).isVisible())
    await shot(page, '10-builder')
    await page.getByRole('button', { name: /Assign to Test Client/ }).click()
    await page.getByRole('heading', { name: 'Workout assigned' }).waitFor({ timeout: 15000 })
    const plans = calls.filter((c) => c.table === 'workout_plans')
    const exs = calls.find((c) => c.table === 'workout_exercises')
    ok('plan created inactive then activated', plans.some((c) => c.method === 'POST' && c.body.active === false) && plans.some((c) => c.method === 'PATCH' && c.body.active === true))
    ok('exercise saved with sets/reps/weight', exs && exs.body[0].sets === 4 && exs.body[0].reps === '9' && exs.body[0].rest_sec === 120 && exs.body[0].weight_kg === 2.5 && exs.body[0].exercise_id === 'e1', JSON.stringify(exs?.body).slice(0, 200))
    await shot(page, '11-assigned')
    await ctx.close()
  }

  /* ---------- desktop: two-column explorer ---------- */
  {
    const { ctx, page } = await setup(browser, 'member', { width: 1280, height: 800 })
    await page.goto(BASE)
    await page.getByRole('button', { name: /Fitness/ }).first().click()
    await page.getByRole('button', { name: /Explore muscles/ }).click()
    await page.getByRole('heading', { name: 'Explore muscles' }).waitFor()
    await page.getByRole('heading', { name: 'Select a muscle' }).waitFor()
    await page.waitForTimeout(1500)
    await page.getByRole('group', { name: 'Muscle groups' }).getByRole('button', { name: 'Chest', exact: true }).click()
    await page.getByRole('button', { name: 'Open Bench Press' }).waitFor()
    const cv = await page.locator('canvas').first().boundingBox()
    const li = await page.getByRole('button', { name: 'Open Bench Press' }).boundingBox()
    ok('desktop: body on the left, exercises on the right', cv && li && li.x > cv.x + cv.width - 5, JSON.stringify({ cv, li }))
    await page.getByRole('button', { name: 'Open Bench Press' }).click()
    await page.getByRole('heading', { name: 'Muscles involved' }).waitFor()
    await page.waitForTimeout(1500)
    ok('desktop: body stays visible beside the exercise detail', (await page.locator('canvas').count()) >= 2 && await page.getByRole('heading', { name: 'Select a muscle' }).isVisible())
    await shot(page, '13-desktop-explorer')
    await ctx.close()
  }

  /* ---------- profile photo: avatar space + upload ---------- */
  {
    const { ctx, page } = await setup(browser, 'member')
    await page.route('**/storage/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Key: 'fit-photos/x', signedURL: '/object/sign/fit-photos/x?token=t' }) }))
    await page.goto(BASE)
    await page.getByRole('button', { name: /Profile/ }).first().click()
    await page.getByRole('button', { name: 'Upload photo' }).waitFor()
    ok('profile photo: round avatar space with initials shown', await page.getByTestId('avatar').first().isVisible())
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
    const before = calls.length
    await page.getByLabel('Choose profile photo').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: png })
    await page.getByText('Profile photo updated.').waitFor({ timeout: 10000 })
    const upd = calls.slice(before).find((c) => c.table === 'profiles' && c.method === 'PATCH')
    ok('profile photo: upload saves avatar_url on the profile', upd && upd.body && /\/avatar-\d+\.jpg$/.test(upd.body.avatar_url), JSON.stringify(upd?.body))
    await page.getByRole('radio', { name: 'Rectangle' }).click()
    ok('profile photo: rectangle shape selectable', (await page.getByRole('radio', { name: 'Rectangle' }).getAttribute('aria-checked')) === 'true')
    await shot(page, '14-profile-photo')
    await ctx.close()
  }

  /* ---------- 3D asset diagnostics: the whole GLB pipeline with the committed test model ---------- */
  {
    const { ctx, page } = await setup(browser, 'admin')
    await page.goto(BASE)
    await page.getByRole('button', { name: /Profile/ }).first().click()
    await page.getByText('3D asset diagnostics').click()
    await page.getByRole('heading', { name: '3D asset diagnostics' }).waitFor()
    await page.getByRole('button', { name: 'Load test model' }).click()
    await page.getByText('Result: loaded').waitFor({ timeout: 20000 })
    ok('diag: GLB loaded, 15 meshes and 2 clips counted', (await page.getByText('Meshes', { exact: true }).locator('xpath=..').innerText()).includes('15') && (await page.getByText('Animation clips', { exact: true }).first().locator('xpath=..').innerText()).includes('2'))
    ok('diag: muscle meshes detected through the mapping', await page.getByText(/Found: Chest \(muscle_pectoralis_major_L/).isVisible() && await page.getByText(/Missing: Rear shoulders/).isVisible())
    ok('diag: clip names listed', await page.locator('li', { hasText: 'TestRep' }).first().isVisible())
    await page.waitForTimeout(2500)
    ok('diag: preview is a real model, not the placeholder', (await page.getByText(/asset not installed/).count()) === 0 && await page.locator('canvas').first().isVisible())
    ok('diag: skin and skeleton layers enabled', await page.getByRole('button', { name: 'Skin', exact: true }).isEnabled() && await page.getByRole('button', { name: 'Skeleton', exact: true }).isEnabled())
    await page.getByRole('button', { name: 'Skin', exact: true }).click()
    await page.getByRole('button', { name: 'Skeleton', exact: true }).click()
    await page.getByRole('button', { name: 'Muscle', exact: true }).click()
    ok('diag: animation plays then pauses', await (async () => {
      await page.getByRole('button', { name: 'Pause', exact: true }).click()
      const paused = await page.getByRole('button', { name: 'Play', exact: true }).isVisible()
      await page.getByRole('button', { name: 'Play', exact: true }).click()
      return paused && await page.getByRole('button', { name: 'Pause', exact: true }).isVisible()
    })())
    ok('diag: clip selector, speeds, restart', await (async () => {
      await page.getByLabel('Animation clip').selectOption('TestSlow')
      await page.getByRole('button', { name: '0.5x' }).click()
      await page.getByRole('button', { name: 'Restart', exact: true }).click()
      return (await page.getByRole('button', { name: '0.5x' }).getAttribute('aria-pressed')) === 'true'
    })())
    await shot(page, '12-diagnostics')
    await page.getByRole('button', { name: 'Check production model' }).click()
    await page.getByText('Failed to load').waitFor({ timeout: 20000 })
    ok('diag: missing production model is reported, not hidden', await page.getByText(/male-anatomy/).first().isVisible())
    await page.getByRole('button', { name: 'Back' }).first().click()
    await page.waitForTimeout(500)
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
