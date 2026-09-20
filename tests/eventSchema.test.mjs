import test from 'node:test'
import assert from 'node:assert/strict'
import { validateEvent } from '../shared/eventSchema.js'

const app = { base_url: 'https://dictee.example.org', indicator_labels: ['mots réussis', 'essais'] }
const EID = '11111111-1111-4111-8111-111111111111'
const base = { event_id: EID, status: 'completed' }

test('événement minimal valide', () => {
  const r = validateEvent(base, app)
  assert.equal(r.ok, true)
  assert.deepEqual(r.value.indicators, [])
  assert.equal(r.value.duration_s, null)
})

test('événement complet valide, valeurs normalisées', () => {
  const r = validateEvent({
    ...base, occurred_at: '2026-09-21T10:00:00Z', duration_s: 300, attempts: 2,
    indicators: [{ label: 'mots réussis', value: 14 }, { label: 'essais', value: 'trois' }],
    detail_url: 'https://dictee.example.org/eleve/42',
  }, app)
  assert.equal(r.ok, true)
  assert.equal(r.value.occurred_at, '2026-09-21T10:00:00.000Z')
  assert.equal(r.value.indicators.length, 2)
})

test('refus : event_id, status', () => {
  assert.equal(validateEvent({ ...base, event_id: 'abc' }, app).ok, false)
  assert.equal(validateEvent({ ...base, status: 'done' }, app).ok, false)
  assert.equal(validateEvent(null, app).ok, false)
})

test('refus : libellé non déclaré, trop long, valeur libre trop longue', () => {
  assert.equal(validateEvent({ ...base, indicators: [{ label: 'inconnu', value: 1 }] }, app).ok, false)
  assert.equal(validateEvent({ ...base, indicators: [{ label: 'essais', value: 'x'.repeat(21) }] }, app).ok, false)
  assert.equal(validateEvent({ ...base, indicators: [{ label: 'essais', value: { a: 1 } }] }, app).ok, false)
  assert.equal(validateEvent({ ...base, indicators: Array(11).fill({ label: 'essais', value: 1 }) }, app).ok, false)
})

test('refus : nombres hors bornes', () => {
  assert.equal(validateEvent({ ...base, duration_s: -1 }, app).ok, false)
  assert.equal(validateEvent({ ...base, duration_s: 90000 }, app).ok, false)
  assert.equal(validateEvent({ ...base, attempts: 1.5 }, app).ok, false)
})

test('refus : detail_url hors domaine de l’app ou invalide', () => {
  assert.equal(validateEvent({ ...base, detail_url: 'https://evil.example.com/x' }, app).ok, false)
  assert.equal(validateEvent({ ...base, detail_url: 'pas une url' }, app).ok, false)
})

test('occurred_at illisible : événement conservé sans date', () => {
  const r = validateEvent({ ...base, occurred_at: 'hier' }, app)
  assert.equal(r.ok, true)
  assert.equal(r.value.occurred_at, null)
})

const bad = (over, a = app) => validateEvent({ ...base, ...over }, a).ok === false

test('detail_url : userinfo, longueur, type, protocole', () => {
  assert.ok(bad({ detail_url: 'https://user:pw@dictee.example.org/x' }))
  assert.ok(bad({ detail_url: 'https://user@dictee.example.org/x' }))
  assert.ok(bad({ detail_url: 'https://dictee.example.org/' + 'a'.repeat(200) }))
  assert.ok(bad({ detail_url: 42 }))
  assert.ok(bad({ detail_url: 'javascript:alert(1)' }, { ...app, base_url: 'data:text/plain,x' }))
  assert.ok(bad({ detail_url: 'data:text/plain,x' }, { ...app, base_url: 'data:text/plain,x' }))
  assert.ok(bad({ detail_url: 'javascript:alert(1)' }))
})

test('detail_url : fragment supprimé', () => {
  const r = validateEvent({ ...base, detail_url: 'https://dictee.example.org/eleve/42#secret' }, app)
  assert.equal(r.ok, true)
  assert.equal(r.value.detail_url, 'https://dictee.example.org/eleve/42')
})

test('indicator_labels non tableau ou app invalide', () => {
  const ind = { indicators: [{ label: 'ess', value: 1 }] }
  assert.ok(bad(ind, { ...app, indicator_labels: 'essais' }))
  assert.ok(bad(ind, { ...app, indicator_labels: null }))
  assert.ok(bad({}, null))
  assert.equal(validateEvent(base, null).error, 'App invalide.')
  assert.equal(validateEvent(base, 'x').ok, false)
})

test('event_id renvoyé en minuscules', () => {
  const r = validateEvent({ ...base, event_id: 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA' }, app)
  assert.equal(r.ok, true)
  assert.equal(r.value.event_id, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
})

test('occurred_at : chaîne, année 2020-2100', () => {
  assert.ok(bad({ occurred_at: 1790000000000 }))
  assert.ok(bad({ occurred_at: true }))
  // Année hors bornes (horloge fausse) : événement conservé, date ignorée
  assert.equal(validateEvent({ ...base, occurred_at: '1970-01-01T00:00:00Z' }, app).value.occurred_at, null)
  assert.equal(validateEvent({ ...base, occurred_at: '2200-01-01T00:00:00Z' }, app).value.occurred_at, null)
  assert.equal(validateEvent({ ...base, occurred_at: '2026-09-21T10:00:00Z' }, app).ok, true)
})

test('valeurs d’indicateurs : bornes et caractères de contrôle', () => {
  const one = (value) => ({ indicators: [{ label: 'essais', value }] })
  assert.ok(bad(one(1e308)))
  assert.ok(bad(one(-1e308)))
  assert.ok(bad(one('a\nb')))
  assert.ok(bad(one('a\u0000b')))
  assert.ok(bad(one('ab')))
  assert.equal(validateEvent({ ...base, ...one(1e9) }, app).ok, true)
  assert.equal(validateEvent({ ...base, ...one('x'.repeat(20)) }, app).ok, true)
})

test('libellés en double refusés, 10 indicateurs OK', () => {
  const r = validateEvent({ ...base, indicators: [{ label: 'essais', value: 1 }, { label: 'essais', value: 2 }] }, app)
  assert.equal(r.ok, false)
  assert.equal(r.error, 'Libellé d’indicateur en double.')
  const labels = Array.from({ length: 10 }, (_, i) => 'l' + i)
  const r10 = validateEvent({ ...base, indicators: labels.map((label) => ({ label, value: 1 })) }, { ...app, indicator_labels: labels })
  assert.equal(r10.ok, true)
})

test('duration_s 86400 accepté, STATUSES gelé', async () => {
  assert.equal(validateEvent({ ...base, duration_s: 86400 }, app).ok, true)
  const { STATUSES } = await import('../shared/eventSchema.js')
  assert.ok(Object.isFrozen(STATUSES))
})
