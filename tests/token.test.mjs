import test from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPair, signToken, verifyToken, TokenError, TOKEN_TTL_SECONDS } from '../shared/token.js'

const NOW = 1_800_000_000
const payload = { tid: 't1', aid: 'a1', code: 'ABCD2345', app: 'dictee', exp: NOW + 3600 }

async function expectCode(promise, code) {
  await assert.rejects(promise, (e) => e instanceof TokenError && e.code === code)
}

test('TTL = 120 h', () => assert.equal(TOKEN_TTL_SECONDS, 120 * 3600))

test('jeton valide : aller-retour', async () => {
  const { privateKey, publicKey } = await generateKeyPair()
  const token = await signToken(payload, privateKey)
  assert.deepEqual(await verifyToken(token, publicKey, NOW), payload)
})

test('jeton expiré', async () => {
  const { privateKey, publicKey } = await generateKeyPair()
  const token = await signToken({ ...payload, exp: NOW - 1 }, privateKey)
  await expectCode(verifyToken(token, publicKey, NOW), 'expired')
})

test('signature d’une autre clé refusée', async () => {
  const a = await generateKeyPair()
  const b = await generateKeyPair()
  const token = await signToken(payload, a.privateKey)
  await expectCode(verifyToken(token, b.publicKey, NOW), 'bad_signature')
})

test('corps altéré (signature d’un autre jeton) refusé', async () => {
  const { privateKey, publicKey } = await generateKeyPair()
  const t1 = await signToken(payload, privateKey)
  const t2 = await signToken({ ...payload, code: 'ZZZZ9999' }, privateKey)
  const forged = `${t2.split('.')[0]}.${t1.split('.')[1]}`
  await expectCode(verifyToken(forged, publicKey, NOW), 'bad_signature')
})

test('jeton mal formé', async () => {
  const { publicKey } = await generateKeyPair()
  await expectCode(verifyToken('nimporte-quoi', publicKey, NOW), 'malformed')
  await expectCode(verifyToken(undefined, publicKey, NOW), 'malformed')
})
