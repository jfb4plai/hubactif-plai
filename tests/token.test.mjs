import test from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPair, signToken, verifyToken, TokenError, TOKEN_TTL_SECONDS, b64uEncode } from '../shared/token.js'

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

test('charge utile altérée avec la signature d’origine refusée', async () => {
  const { privateKey, publicKey } = await generateKeyPair()
  const token = await signToken(payload, privateKey)
  const forgedBody = b64uEncode(new TextEncoder().encode(JSON.stringify({ ...payload, exp: NOW + 999999 })))
  const forged = `${forgedBody}.${token.split('.')[1]}`
  await expectCode(verifyToken(forged, publicKey, NOW), 'bad_signature')
})

test('ordre : signature vérifiée avant expiration', async () => {
  const a = await generateKeyPair()
  const b = await generateKeyPair()
  const token = await signToken({ ...payload, exp: NOW - 100 }, a.privateKey)
  await expectCode(verifyToken(token, b.publicKey, NOW), 'bad_signature')
})

test('limite : exp === now est expiré', async () => {
  const { privateKey, publicKey } = await generateKeyPair()
  const token = await signToken({ ...payload, exp: NOW }, privateKey)
  await expectCode(verifyToken(token, publicKey, NOW), 'expired')
})

test('jeton à trois parties ou corps non JSON : malformed', async () => {
  const { publicKey } = await generateKeyPair()
  await expectCode(verifyToken('a.b.c', publicKey, NOW), 'malformed')
  const notJson = b64uEncode(new TextEncoder().encode('pas du json')) + '.AAAA'
  await expectCode(verifyToken(notJson, publicKey, NOW), 'malformed')
})

test('charge utile signée sans exp : expired', async () => {
  const { privateKey, publicKey } = await generateKeyPair()
  const token = await signToken({ tid: 't1' }, privateKey)
  await expectCode(verifyToken(token, publicKey, NOW), 'expired')
})

test('signature dont un bit est inversé refusée', async () => {
  const { privateKey, publicKey } = await generateKeyPair()
  const token = await signToken(payload, privateKey)
  const [body, sig] = token.split('.')
  // Le dernier caractère base64url d'une signature de 64 octets ne porte que 4 bits utiles :
  // on inverse le bit de poids fort (index +/-32) pour garantir un changement réel des octets.
  const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  const flipped = ALPHA[ALPHA.indexOf(sig.at(-1)) ^ 32]
  const forged = `${body}.${sig.slice(0, -1)}${flipped}`
  assert.notEqual(forged, token)
  await expectCode(verifyToken(forged, publicKey, NOW), 'bad_signature')
})
