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

// ---- Robustesse (revue) ----
const okRes = { ok: true, status: 200 }

test('jeton sans remplissage base64 est décodé', () => {
  const t = mkToken({ ...payload, code: 'ABCD2345XY' })
  assert.ok(!t.split('.')[0].includes('='))
  const { client } = make({ token: t })
  assert.equal(client.captureToken().code, 'ABCD2345XY')
})

test('jeton non JSON ou géant => pas de contexte, sans exception', () => {
  assert.equal(make({ token: 'pas-du-json.sig' }).client.captureToken(), null)
  assert.equal(make({ token: mkToken({ ...payload, pad: 'x'.repeat(3000) }) }).client.captureToken(), null)
})

test('stockage qui lève : repli mémoire, clearContext efface tout', () => {
  const boom = () => { throw new Error('x') }
  const { client } = make({ storage: { getItem: boom, setItem: boom, removeItem: boom } })
  assert.equal(client.captureToken().code, 'ABCD2345')
  assert.equal(client.getContext().code, 'ABCD2345')
  client.clearContext()
  assert.equal(client.getContext(), null)
})

test('history indéfini : pas d’exception', () => {
  const client = createHubClient({
    storage: memStorage(), location: { href: `https://a.org/x?t=${mkToken(payload)}` },
    history: undefined, fetchImpl: async () => okRes, now: () => NOW, uuid: () => 'u',
  })
  assert.equal(client.captureToken().code, 'ABCD2345')
})

test('replaceState conserve history.state', () => {
  const replaced = []
  const client = createHubClient({
    storage: memStorage(), location: { href: `https://a.org/x?t=${mkToken(payload)}` },
    history: { state: { route: 1 }, replaceState: (...a) => replaced.push(a) },
    fetchImpl: async () => okRes, now: () => NOW, uuid: () => 'u',
  })
  client.captureToken()
  assert.deepEqual(replaced[0][0], { route: 1 })
})

test('file d’attente plafonnée à 50', async () => {
  let n = 0
  const storage = memStorage()
  const client = createHubClient({
    storage, location: { href: `https://a.org/?t=${mkToken(payload)}` }, history: {},
    fetchImpl: async () => { throw new Error('off') }, now: () => NOW, uuid: () => `u${n++}`,
  })
  client.captureToken()
  for (let i = 0; i < 55; i++) await client.reportEvent({ status: 'started' })
  const q = JSON.parse(storage.getItem('hub_queue'))
  assert.equal(q.length, 50)
  assert.equal(q[49].event_id, 'u54')
})

test('file corrompue (non tableau) => traitée comme vide', async () => {
  const { client, storage } = make()
  storage.setItem('hub_queue', '{"a":1}')
  assert.equal(await client.flushQueue(), 0)
})

test('file impossible à écrire => storage_unavailable', async () => {
  const storage = memStorage()
  const { client } = make({ storage, fetchImpl: async () => { throw new Error('off') } })
  client.captureToken()
  const orig = storage.setItem
  storage.setItem = (k, v) => { if (k === 'hub_queue') throw new Error('quota'); return orig(k, v) }
  assert.deepEqual(await client.reportEvent({ status: 'started' }), { sent: false, queued: false, reason: 'storage_unavailable' })
})

test('429 et 408 : conservés pour réessai', async () => {
  const statuses = [429, 408]
  const { client, storage } = make({ fetchImpl: async () => ({ ok: false, status: statuses.shift() }) })
  storage.setItem('hub_queue', JSON.stringify([{ event_id: 'e1' }, { event_id: 'e2' }]))
  assert.equal(await client.flushQueue(), 2)
})

test('401 avec jeton local valide : conservé (compteur), abandonné au 20e essai', async () => {
  const { client, storage } = make({ fetchImpl: async () => ({ ok: false, status: 401 }) })
  storage.setItem('hub_queue', JSON.stringify([{ event_id: 'e1', token: mkToken(payload) }]))
  assert.equal(await client.flushQueue(), 1)
  assert.equal(JSON.parse(storage.getItem('hub_queue'))[0].tries, 1)
  for (let i = 0; i < 18; i++) await client.flushQueue()
  assert.equal(JSON.parse(storage.getItem('hub_queue'))[0].tries, 19)
  assert.equal(await client.flushQueue(), 0)
})

test('401 avec jeton expiré ou absent : abandonné', async () => {
  const { client, storage } = make({ fetchImpl: async () => ({ ok: false, status: 401 }) })
  storage.setItem('hub_queue', JSON.stringify([
    { event_id: 'e1', token: mkToken({ ...payload, exp: NOW / 1000 - 5 }) }, { event_id: 'e2' },
  ]))
  assert.equal(await client.flushQueue(), 0)
})

test('flushQueue concurrents : le second ne renvoie rien', async () => {
  let calls = 0
  let release
  const gate = new Promise((r) => { release = r })
  const { client, storage } = make({ fetchImpl: async () => { calls++; await gate; return okRes } })
  storage.setItem('hub_queue', JSON.stringify([{ event_id: 'e1' }, { event_id: 'e2' }]))
  const first = client.flushQueue()
  assert.equal(await client.flushQueue(), 2)
  release()
  assert.equal(await first, 0)
  assert.equal(calls, 2)
})

test('flushQueue en course avec reportEvent : l’événement ajouté n’est pas perdu', async () => {
  let release
  const gate = new Promise((r) => { release = r })
  let mode = 'flush'
  const { client, storage } = make({
    fetchImpl: async () => { if (mode === 'flush') { await gate; return okRes } throw new Error('off') },
  })
  client.captureToken()
  storage.setItem('hub_queue', JSON.stringify([{ event_id: 'old' }]))
  const flushing = client.flushQueue()
  mode = 'report'
  assert.equal((await client.reportEvent({ status: 'started' })).queued, true)
  release()
  assert.equal(await flushing, 1)
  assert.deepEqual(JSON.parse(storage.getItem('hub_queue')).map((e) => e.event_id), ['uuid-1'])
})

test('délai dépassé : requête abandonnée, événement mis en file', async () => {
  const storage = memStorage()
  const client = createHubClient({
    storage, location: { href: `https://a.org/x?t=${mkToken(payload)}` }, history: {},
    fetchImpl: (url, init) => new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(new Error('aborted')))),
    now: () => NOW, uuid: () => 'u', timeoutMs: 20,
  })
  client.captureToken()
  assert.deepEqual(await client.reportEvent({ status: 'started' }), { sent: false, queued: true })
  assert.equal(JSON.parse(storage.getItem('hub_queue')).length, 1)
})

test('uuid par défaut : repli si crypto.randomUUID est absent (ou crypto absent)', async () => {
  const sent = []
  const orig = Object.getOwnPropertyDescriptor(globalThis, 'crypto')
  const setCrypto = (v) => Object.defineProperty(globalThis, 'crypto', { value: v, configurable: true, writable: true })
  try {
    for (const fake of [{ getRandomValues: (a) => { a.fill(7); return a } }, undefined]) {
      setCrypto(fake)
      const client = createHubClient({
        storage: memStorage(), location: { href: `https://a.org/?t=${mkToken(payload)}` }, history: {},
        fetchImpl: async (u, init) => { sent.push(JSON.parse(init.body)); return okRes }, now: () => NOW,
      })
      client.captureToken()
      await client.reportEvent({ status: 'started' })
    }
  } finally {
    Object.defineProperty(globalThis, 'crypto', orig)
  }
  assert.equal(sent.length, 2)
  assert.match(sent[0].event_id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  assert.ok(sent[1].event_id.length >= 16)
})

test('file contenant des entrées corrompues : elles sont ignorées, flushQueue ne lève pas', async () => {
  const { client, storage } = make()
  storage.setItem('hub_queue', '[null,1,{"event_id":"e1"}]')
  assert.equal(await client.flushQueue(), 0)
  assert.deepEqual(JSON.parse(storage.getItem('hub_queue')), [])
})

test('setItem qui lève mais getItem renvoie un vieux jeton : le jeton mémoire frais gagne', () => {
  const old = mkToken({ ...payload, aid: 'old', exp: NOW / 1000 - 10 })
  const storage = { getItem: () => old, setItem: () => { throw new Error('quota') }, removeItem: () => {} }
  const { client } = make({ storage })
  const ctx = client.captureToken()
  assert.equal(ctx.assignmentId, 'a1')
})
