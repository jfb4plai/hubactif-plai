import test from 'node:test'
import assert from 'node:assert/strict'
import { pickLiveLink } from '../src/lib/links.js'

const now = new Date('2026-09-20T10:00:00Z')
test('dernier lien non révoqué et non expiré', () => {
  const links = [
    { id: 'old', revoked: false, created_at: '2026-09-01T00:00:00Z', expires_at: null },
    { id: 'new', revoked: false, created_at: '2026-09-10T00:00:00Z', expires_at: '2026-10-10T00:00:00Z' },
    { id: 'rev', revoked: true, created_at: '2026-09-15T00:00:00Z', expires_at: null },
    { id: 'exp', revoked: false, created_at: '2026-09-18T00:00:00Z', expires_at: '2026-09-19T00:00:00Z' },
  ]
  assert.equal(pickLiveLink(links, now).id, 'new')
})
test('aucun lien valide : undefined', () => {
  assert.equal(pickLiveLink([{ id: 'x', revoked: true, created_at: '2026-09-01T00:00:00Z' }], now), undefined)
  assert.equal(pickLiveLink(undefined, now), undefined)
})
