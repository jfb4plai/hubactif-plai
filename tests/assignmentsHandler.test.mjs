import test from 'node:test'
import assert from 'node:assert/strict'
import { createAssignmentsHandler } from '../api/_lib/assignmentsHandler.js'
import { fakeReq, fakeRes } from './helpers.mjs'

const APP_ID = '11111111-1111-4111-8111-111111111111'
const CLASS_ID = '22222222-2222-4222-8222-222222222222'
const app = { id: APP_ID, base_url: 'https://dictee.example.org', revoked: false }
const good = { app_id: APP_ID, class_id: CLASS_ID, title: 'Dictée n°3', deep_link: 'https://dictee.example.org/dictee/3' }
const rows = [
  { out_assignment_id: 'as1', out_student_code: 'ABCD2345', out_link_id: 'a1b2c3d4e5f60718' },
  { out_assignment_id: 'as1', out_student_code: 'EFGH6789', out_link_id: '0123456789abcdef' },
]

function setup({ user = { id: 'u1' }, foundApp = app, create, allowed = true, rowsResult = rows } = {}) {
  const created = []
  const rates = []
  const handler = createAssignmentsHandler({
    requireUser: async (req, res) => { if (!user) { res.status(401).json({ error: 'Connexion requise.' }); return null } return user },
    findApp: async () => foundApp,
    createAssignment: create ?? (async (a) => { created.push(a); return rowsResult }),
    rateCheck: async (key, max, win) => { rates.push([key, max, win]); return allowed },
  })
  const call = async (body, method = 'POST') => { const res = fakeRes(); await handler(fakeReq({ method, body, headers: { 'x-real-ip': '7.7.7.7' } }), res); return res }
  return { call, created, rates }
}

test('405 si ce n’est pas un POST', async () => {
  assert.equal((await setup().call(good, 'GET')).statusCode, 405)
})

test('401 sans enseignant connecté', async () => {
  assert.equal((await setup({ user: null }).call(good)).statusCode, 401)
})

test('400 app inconnue ou révoquée', async () => {
  assert.equal((await setup({ foundApp: null }).call(good)).statusCode, 400)
  assert.equal((await setup({ foundApp: { ...app, revoked: true } }).call(good)).statusCode, 400)
  assert.equal((await setup().call({ ...good, app_id: 'pas-un-uuid' })).statusCode, 400)
})

test('400 lien hors domaine de l’app', async () => {
  const res = await setup().call({ ...good, deep_link: 'https://evil.example.com/x' })
  assert.equal(res.statusCode, 400)
})

test('200 : renvoie l’assignation et un lien par élève', async () => {
  const { call, created } = setup()
  const res = await call(good)
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.assignment_id, 'as1')
  assert.deepEqual(res.body.links, [
    { student_code: 'ABCD2345', link_id: 'a1b2c3d4e5f60718' },
    { student_code: 'EFGH6789', link_id: '0123456789abcdef' },
  ])
  assert.equal(created[0].teacher, 'u1')
  assert.equal(created[0].class_id, CLASS_ID)
  assert.equal(created[0].student_ids, null)
})

test('403 classe qui n’appartient pas à l’enseignant, 400 sans élève', async () => {
  const mk = (msg) => async () => { throw { message: msg } }
  assert.equal((await setup({ create: mk('class_not_owned') }).call(good)).statusCode, 403)
  const res = await setup({ create: mk('no_students') }).call(good)
  assert.equal(res.statusCode, 400)
  assert.match(res.body.error, /Aucun élève/)
  assert.equal((await setup({ create: mk('domain_not_allowed') }).call(good)).statusCode, 400)
})

test('429 si limite de débit dépassée', async () => {
  assert.equal((await setup({ allowed: false }).call(good)).statusCode, 429)
})

test('clés de débit : IP avant requireUser, puis utilisateur', async () => {
  const { call, rates } = setup()
  await call(good)
  assert.deepEqual(rates, [['assign:ip:7.7.7.7', 120, 60], ['assign:u1', 60, 60]])
})

test('429 par IP sans appeler requireUser', async () => {
  let asked = 0
  const handler = createAssignmentsHandler({
    requireUser: async () => { asked++; return { id: 'u1' } },
    findApp: async () => app, createAssignment: async () => rows,
    rateCheck: async () => false,
  })
  const res = fakeRes()
  await handler(fakeReq({ body: good }), res)
  assert.equal(res.statusCode, 429)
  assert.equal(asked, 0)
})

test('400 si la création ne renvoie aucune ligne (pas de TypeError)', async () => {
  for (const rowsResult of [[], null, {}]) {
    const res = await setup({ rowsResult }).call(good)
    assert.equal(res.statusCode, 400)
    assert.match(res.body.error, /Aucun élève actif/)
  }
})

test('anti mass-assignment : teacher, app, id du corps ne passent pas', async () => {
  const { call, created } = setup()
  await call({ ...good, teacher: 'pirate', app: 'autre', id: 'x', assignment: 'y' })
  assert.equal(created[0].teacher, 'u1')
  assert.equal(created[0].app, APP_ID)
  assert.equal(created[0].id, undefined)
  assert.equal(created[0].assignment, undefined)
})
