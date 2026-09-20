import test from 'node:test'
import assert from 'node:assert/strict'
import { needsReset, linkExpiry, LINK_GRACE_DAYS } from '../shared/dates.js'
import { sha256Hex } from '../shared/hash.js'

const d = (s) => new Date(s)

test('needsReset : avant le 15 juillet, jamais', () => {
  assert.equal(needsReset(d('2027-06-01T00:00:00Z'), { createdAt: '2026-09-01T00:00:00Z', lastResetAt: null }), false)
  assert.equal(needsReset(d('2027-07-14T23:59:00Z'), { createdAt: '2026-09-01T00:00:00Z', lastResetAt: null }), false)
})

test('needsReset : dès le 15 juillet pour une classe de l’année écoulée', () => {
  assert.equal(needsReset(d('2027-07-15T00:00:00Z'), { createdAt: '2026-09-01T00:00:00Z', lastResetAt: null }), true)
  assert.equal(needsReset(d('2027-07-20T00:00:00Z'), { createdAt: '2026-09-01T00:00:00Z', lastResetAt: '2026-10-01T00:00:00Z' }), true)
})

test('needsReset : plus rien à faire une fois remise à zéro cette année', () => {
  assert.equal(needsReset(d('2027-07-20T00:00:00Z'), { createdAt: '2026-09-01T00:00:00Z', lastResetAt: '2027-07-16T00:00:00Z' }), false)
})

test('needsReset : une classe créée après le 15 juillet n’est pas concernée cette année', () => {
  assert.equal(needsReset(d('2026-09-20T00:00:00Z'), { createdAt: '2026-09-05T00:00:00Z', lastResetAt: null }), false)
})

test('linkExpiry : échéance + 30 jours, ou null', () => {
  assert.equal(LINK_GRACE_DAYS, 30)
  assert.equal(linkExpiry('2026-10-01T12:00:00Z'), '2026-10-31T12:00:00.000Z')
  assert.equal(linkExpiry(null), null)
})

test('sha256Hex', () => {
  assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
})
