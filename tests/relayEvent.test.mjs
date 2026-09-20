import test from 'node:test'
import assert from 'node:assert/strict'
import handler from '../sdk/relay-event.js'
import { fakeReq, fakeRes } from './helpers.mjs'

const realFetch = globalThis.fetch
const env = { key: process.env.HUB_APP_KEY, url: process.env.HUB_URL }
const restore = () => {
  globalThis.fetch = realFetch
  for (const [k, v] of [['HUB_APP_KEY', env.key], ['HUB_URL', env.url]]) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
}

test('405 hors POST', async () => {
  const res = fakeRes()
  await handler(fakeReq({ method: 'GET' }), res)
  assert.equal(res.statusCode, 405)
})

test('503 sans clé', async () => {
  delete process.env.HUB_APP_KEY
  const res = fakeRes()
  await handler(fakeReq(), res)
  assert.equal(res.statusCode, 503)
  restore()
})

test('clé nettoyée, URL sans barre finale, corps transmis, réponse relayée, no-store', async () => {
  process.env.HUB_APP_KEY = '  hubkey_abc\n'
  process.env.HUB_URL = ' https://hub.example.org// '
  const calls = []
  globalThis.fetch = async (url, init) => { calls.push([url, init]); return { status: 202, json: async () => ({ ok: true, n: 1 }) } }
  try {
    const res = fakeRes()
    await handler(fakeReq({ body: { event_id: 'e1' } }), res)
    assert.equal(calls[0][0], 'https://hub.example.org/api/events')
    assert.equal(calls[0][1].headers['x-app-key'], 'hubkey_abc')
    assert.equal(calls[0][1].body, JSON.stringify({ event_id: 'e1' }))
    assert.ok(calls[0][1].signal)
    assert.equal(res.statusCode, 202)
    assert.deepEqual(res.body, { ok: true, n: 1 })
    assert.equal(res.headers['cache-control'], 'no-store')
  } finally { restore() }
})

test('statut et corps amont relayés (erreur)', async () => {
  process.env.HUB_APP_KEY = 'k'
  globalThis.fetch = async () => ({ status: 401, json: async () => ({ error: 'Jeton invalide.' }) })
  try {
    const res = fakeRes()
    await handler(fakeReq({ body: {} }), res)
    assert.equal(res.statusCode, 401)
    assert.deepEqual(res.body, { error: 'Jeton invalide.' })
  } finally { restore() }
})

test('hub injoignable => 502', async () => {
  process.env.HUB_APP_KEY = 'k'
  globalThis.fetch = async () => { throw new Error('down') }
  try {
    const res = fakeRes()
    await handler(fakeReq({ body: {} }), res)
    assert.equal(res.statusCode, 502)
    assert.deepEqual(res.body, { error: 'Hub injoignable.' })
  } finally { restore() }
})
