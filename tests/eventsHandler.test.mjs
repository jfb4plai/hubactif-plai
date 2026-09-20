import test from 'node:test'
import assert from 'node:assert/strict'
import { createEventsHandler } from '../api/_lib/eventsHandler.js'
import { generateKeyPair, signToken } from '../shared/token.js'
import { fakeReq, fakeRes } from './helpers.mjs'

const NOW = 1_800_000_000_000
const EID = '11111111-1111-4111-8111-111111111111'
const app = { slug: 'dictee', base_url: 'https://dictee.example.org', indicator_labels: ['mots réussis'], revoked: false }

async function setup(over = {}) {
  const keys = await generateKeyPair()
  const calls = []
  const handler = createEventsHandler({
    findAppByKeyHash: async (h) => (h === 'hash:good' ? (over.app ?? app) : null),
    recordEvent: async (e) => { calls.push(e); return over.result ?? 'recorded' },
    rateCheck: async () => over.allowed ?? true,
    publicKey: keys.publicKey,
    hash: (k) => `hash:${k}`,
    now: () => NOW,
  })
  const token = (payload = {}, key = keys.privateKey) =>
    signToken({ tid: 't1', aid: 'a1', code: 'ABCD2345', app: 'dictee', exp: NOW / 1000 + 3600, ...payload }, key)
  const call = async ({ key = 'good', method = 'POST', body }) => {
    const res = fakeRes()
    await handler(fakeReq({ method, headers: key ? { 'x-app-key': key } : {}, body }), res)
    return res
  }
  return { call, calls, token }
}

const okBody = (token, extra = {}) => ({ event_id: EID, token, status: 'completed', duration_s: 120, indicators: [{ label: 'mots réussis', value: 14 }], ...extra })

test('405 si ce n’est pas un POST', async () => {
  const { call } = await setup()
  assert.equal((await call({ method: 'GET' })).statusCode, 405)
})

test('429 si limite de débit dépassée', async () => {
  const { call, token } = await setup({ allowed: false })
  assert.equal((await call({ body: okBody(await token()) })).statusCode, 429)
})

test('401 sans clé d’app', async () => {
  const { call, token } = await setup()
  assert.equal((await call({ key: null, body: okBody(await token()) })).statusCode, 401)
})

test('401 clé inconnue', async () => {
  const { call, token } = await setup()
  assert.equal((await call({ key: 'mauvaise', body: okBody(await token()) })).statusCode, 401)
})

test('401 app révoquée', async () => {
  const { call, token } = await setup({ app: { ...app, revoked: true } })
  assert.equal((await call({ body: okBody(await token()) })).statusCode, 401)
})

test('401 jeton absent, signé par une autre clé, ou expiré', async () => {
  const { call, token } = await setup()
  const other = await generateKeyPair()
  assert.equal((await call({ body: okBody(undefined) })).statusCode, 401)
  assert.equal((await call({ body: okBody(await token({}, other.privateKey)) })).statusCode, 401)
  assert.equal((await call({ body: okBody(await token({ exp: NOW / 1000 - 10 })) })).statusCode, 401)
})

test('401 corps non JSON (chaîne) : jeton absent, sans plantage', async () => {
  const { call, calls } = await setup()
  const res = await call({ body: 'ceci n’est pas du JSON' })
  assert.equal(res.statusCode, 401)
  assert.equal(calls.length, 0)
})

test('403 jeton émis pour une autre app', async () => {
  const { call, token } = await setup()
  assert.equal((await call({ body: okBody(await token({ app: 'lexiactif' })) })).statusCode, 403)
})

test('400 événement hors schéma (libellé non déclaré)', async () => {
  const { call, token, calls } = await setup()
  const res = await call({ body: okBody(await token(), { indicators: [{ label: 'phrase dictée', value: 'Maëlle a écrit' }] }) })
  assert.equal(res.statusCode, 400)
  assert.equal(calls.length, 0)
})

test('200 enregistré : transmet cible, assignation, app et valeurs nettoyées', async () => {
  const { call, token, calls } = await setup()
  const res = await call({ body: okBody(await token()) })
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body, { status: 'recorded' })
  assert.equal(calls[0].target, 't1')
  assert.equal(calls[0].assignment, 'a1')
  assert.equal(calls[0].appSlug, 'dictee')
  assert.equal(calls[0].event_id, EID)
})

test('200 doublon renvoyé tel quel (idempotence)', async () => {
  const { call, token } = await setup({ result: 'duplicate' })
  const res = await call({ body: okBody(await token()) })
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body, { status: 'duplicate' })
})

test('404 cible inconnue', async () => {
  const { call, token } = await setup({ result: 'unknown_target' })
  assert.equal((await call({ body: okBody(await token()) })).statusCode, 404)
})
