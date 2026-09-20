// Usage : lancer `npx vercel dev --listen 3000` dans un terminal, puis `npm run test:e2e`.
// HUB_BASE_URL permet de viser un déploiement (ex. https://hubactif-plai.vercel.app).
import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { sha256Hex } from '../shared/hash.js'
import { generateCode } from '../shared/codes.js'

const BASE = process.env.HUB_BASE_URL || 'http://localhost:3000'
const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env
const opts = { auth: { persistSession: false } }
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, opts)
const stamp = Date.now()
const results = []
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${JSON.stringify(detail)}`}`) }

async function post(path, body, headers = {}) {
  const res = await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) })
  return { status: res.status, json: await res.json().catch(() => ({})) }
}

let userId, appId
try {
  // --- Comptes et données de départ ---
  const email = `smoke-${stamp}@hubactif.test`
  const password = `Pw-${stamp}-smoke!`
  const { data: u, error: e0 } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (e0) throw e0
  userId = u.user.id
  const teacher = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, opts)
  const { data: s, error: e1 } = await teacher.auth.signInWithPassword({ email, password })
  if (e1) throw e1
  const bearer = { Authorization: `Bearer ${s.session.access_token}` }

  const appKey = `hubkey_smoke_${randomBytes(16).toString('hex')}`
  const { data: app, error: e2 } = await admin.from('hub_apps').insert({
    slug: `smoke-${stamp}`, name: 'App smoke', base_url: 'http://localhost:9999', key_hash: sha256Hex(appKey), indicator_labels: ['mots réussis'],
  }).select().single()
  if (e2) throw e2
  appId = app.id

  const classCode = generateCode(6)
  const { data: cls, error: e3 } = await admin.from('hub_classes').insert({ teacher_id: userId, name: 'Classe smoke', class_code: classCode }).select().single()
  if (e3) throw e3
  const codes = [generateCode(), generateCode()]
  const { error: e4 } = await admin.from('hub_students').insert(codes.map((code) => ({ class_id: cls.id, code })))
  if (e4) throw e4

  // --- Assignation ---
  const payload = { app_id: app.id, class_id: cls.id, title: 'Tâche smoke', deep_link: 'http://localhost:9999/t/1', student_ids: 'all' }
  const noAuth = await post('/api/assignments', payload)
  check('assignation sans connexion : 401', noAuth.status === 401, noAuth)
  const foreign = await post('/api/assignments', { ...payload, deep_link: 'https://evil.example.com/x' }, bearer)
  check('assignation vers un autre domaine : 400', foreign.status === 400, foreign)
  const created = await post('/api/assignments', payload, bearer)
  check('assignation : 200 avec un lien par élève', created.status === 200 && created.json.links?.length === 2, created)
  const link = created.json.links[0]

  // --- Lien court ---
  const go = await fetch(`${BASE}/a/${link.link_id}`, { redirect: 'manual' })
  const location = go.headers.get('location') ?? ''
  check('lien court : 302 vers l’app avec jeton', go.status === 302 && location.startsWith('http://localhost:9999/t/1?t='), { status: go.status, location })
  const token = new URL(location).searchParams.get('t')
  const dead = await fetch(`${BASE}/a/0000000000000000`, { redirect: 'manual' })
  check('lien court inconnu : 410', dead.status === 410)

  // --- Événements ---
  const evt = { event_id: crypto.randomUUID(), token, status: 'completed', duration_s: 90, indicators: [{ label: 'mots réussis', value: 14 }] }
  const h = { 'x-app-key': appKey }
  const r1 = await post('/api/events', evt, h)
  check('événement : 200 enregistré', r1.status === 200 && r1.json.status === 'recorded', r1)
  const r2 = await post('/api/events', evt, h)
  check('événement rejoué : 200 doublon', r2.status === 200 && r2.json.status === 'duplicate', r2)
  check('événement sans clé : 401', (await post('/api/events', evt, {})).status === 401)
  check('événement, mauvaise clé : 401', (await post('/api/events', evt, { 'x-app-key': 'hubkey_faux' })).status === 401)
  const badLabel = await post('/api/events', { ...evt, event_id: crypto.randomUUID(), indicators: [{ label: 'phrase dictée', value: 'x' }] }, h)
  check('événement hors schéma : 400', badLabel.status === 400, badLabel)
  const badToken = await post('/api/events', { ...evt, event_id: crypto.randomUUID(), token: `${token}x` }, h)
  check('événement, jeton altéré : 401', badToken.status === 401, badToken)

  // --- Espace élève ---
  const tasks = await post('/api/student', { class_code: classCode.toLowerCase(), student_code: link.student_code.toLowerCase() })
  check('espace élève : la tâche apparaît, terminée', tasks.status === 200 && tasks.json.tasks?.[0]?.status === 'completed', tasks)
  const other = await post('/api/student', { class_code: classCode, student_code: codes.find((c) => c !== link.student_code) })
  check('espace élève : l’autre élève voit sa propre tâche, non terminée', other.json.tasks?.[0]?.status === 'assigned', other)
  const wrong = await post('/api/student', { class_code: classCode, student_code: 'INCONNU1' })
  check('espace élève : codes inconnus 404 neutre', wrong.status === 404 && wrong.json.error === 'Codes non reconnus.', wrong)
} finally {
  if (userId) await admin.auth.admin.deleteUser(userId)
  if (appId) await admin.from('hub_apps').delete().eq('id', appId)
}

const failed = results.filter((r) => !r).length
console.log(`\n${results.length - failed}/${results.length} vérifications réussies`)
process.exit(failed ? 1 : 0)
