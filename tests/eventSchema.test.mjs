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

test('refus : occurred_at invalide', () => {
  assert.equal(validateEvent({ ...base, occurred_at: 'hier' }, app).ok, false)
})
