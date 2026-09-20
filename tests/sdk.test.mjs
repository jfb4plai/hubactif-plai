import test from 'node:test'
import assert from 'node:assert/strict'
import { createHubClient } from '../sdk/hub-client.js'
import { b64uEncode } from '../shared/token.js'

const NOW = 1_800_000_000_000
const mkToken = (p) => `${b64uEncode(new TextEncoder().encode(JSON.stringify(p)))}.sig`
const payload = { tid: 't1', aid: 'a1', code: 'ABCD2345', app: 'dictee', exp: NOW / 1000 + 3600 }

const memStorage = () => {
  const m = new Map()
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }
}

function make({ token = mkToken(payload), fetchImpl = async () => ({ ok: true, status: 200 }), storage = memStorage() } = {}) {
  const replaced = []
  const client = createHubClient({
    storage,
    location: { href: `https://dictee.example.org/dictee/3?lang=fr${token ? `&t=${token}` : ''}#x` },
    history: { replaceState: (...a) => replaced.push(a) },
    fetchImpl, now: () => NOW, uuid: () => 'uuid-1', hubUrl: 'https://hub.example.org',
  })
  return { client, storage, replaced }
}

test('captureToken lit le jeton, le range et le retire de l’URL', () => {
  const { client, replaced } = make()
  const ctx = client.captureToken()
  assert.equal(ctx.code, 'ABCD2345')
  assert.equal(ctx.assignmentId, 'a1')
  assert.equal(replaced[0][2], '/dictee/3?lang=fr#x')
  assert.equal(client.getContext().code, 'ABCD2345') // persiste sans le paramètre
})

test('jeton expiré => pas de contexte', () => {
  const { client } = make({ token: mkToken({ ...payload, exp: NOW / 1000 - 1 }) })
  assert.equal(client.captureToken(), null)
})

test('sans jeton => pas de contexte', () => {
  const { client } = make({ token: '' })
  assert.equal(client.captureToken(), null)
})

test('reportEvent envoie au relais avec jeton, identifiant et champs connus seulement', async () => {
  const sent = []
  const { client } = make({ fetchImpl: async (url, init) => { sent.push([url, JSON.parse(init.body)]); return { ok: true, status: 200 } } })
  client.captureToken()
  const r = await client.reportEvent({ status: 'completed', duration_s: 90, indicators: [{ label: 'essais', value: 2 }], secret: 'ignoré' })
  assert.deepEqual(r, { sent: true })
  assert.equal(sent[0][0], '/api/hub-event')
  assert.equal(sent[0][1].event_id, 'uuid-1')
  assert.equal(sent[0][1].status, 'completed')
  assert.equal(sent[0][1].occurred_at, new Date(NOW).toISOString())
  assert.ok(sent[0][1].token)
  assert.equal(sent[0][1].secret, undefined)
})

test('reportEvent sans contexte : rien n’est envoyé', async () => {
  const { client } = make({ token: '' })
  assert.deepEqual(await client.reportEvent({ status: 'started' }), { sent: false, reason: 'no_context' })
})

test('réseau en panne : l’événement est mis en file, puis renvoyé', async () => {
  let online = false
  const { client, storage } = make({ fetchImpl: async () => { if (!online) throw new Error('offline'); return { ok: true, status: 200 } } })
  client.captureToken()
  assert.deepEqual(await client.reportEvent({ status: 'started' }), { sent: false, queued: true })
  assert.equal(JSON.parse(storage.getItem('hub_queue')).length, 1)
  online = true
  assert.equal(await client.flushQueue(), 0)
  assert.equal(JSON.parse(storage.getItem('hub_queue')).length, 0)
})

test('flushQueue : 5xx conservé, 4xx abandonné', async () => {
  const statuses = [500, 400]
  const { client, storage } = make({ fetchImpl: async () => ({ ok: false, status: statuses.shift() }) })
  storage.setItem('hub_queue', JSON.stringify([{ event_id: 'e1' }, { event_id: 'e2' }]))
  assert.equal(await client.flushQueue(), 1)
  assert.deepEqual(JSON.parse(storage.getItem('hub_queue')), [{ event_id: 'e1' }])
})

test('assignUrl construit l’adresse de la page « Assigner » du hub', () => {
  const { client } = make()
  const u = new URL(client.assignUrl({ app: 'dictee', title: 'Dictée n°3', link: 'https://dictee.example.org/dictee/3', type: 'dictée', domain: 'Orthographe' }))
  assert.equal(u.origin, 'https://hub.example.org')
  assert.equal(u.pathname, '/enseignant/assigner')
  assert.equal(u.searchParams.get('app'), 'dictee')
  assert.equal(u.searchParams.get('title'), 'Dictée n°3')
  assert.equal(u.searchParams.get('link'), 'https://dictee.example.org/dictee/3')
  assert.equal(u.searchParams.get('domain'), 'Orthographe')
})

test('clearContext efface le jeton (poste partagé)', () => {
  const { client } = make()
  client.captureToken()
  client.clearContext()
  assert.equal(client.getContext(), null)
})
