import test from 'node:test'
import assert from 'node:assert/strict'
import { createPurgeHandler } from '../api/_lib/purgeHandler.js'
import { fakeReq, fakeRes } from './helpers.mjs'

function setup(secret = 's3cret') {
  let calls = 0
  const handler = createPurgeHandler({ secret, purge: async () => { calls++; return 4 } })
  const call = async (headers, method = 'GET') => { const res = fakeRes(); await handler(fakeReq({ method, headers }), res); return res }
  return { call, count: () => calls }
}

test('refuse sans en-tête ou avec un mauvais secret', async () => {
  const { call, count } = setup()
  assert.equal((await call({})).statusCode, 401)
  assert.equal((await call({ authorization: 'Bearer autre' })).statusCode, 401)
  assert.equal(count(), 0)
})

test('refuse un jeton de longueur différente', async () => {
  const { call, count } = setup()
  assert.equal((await call({ authorization: 'Bearer s3cret-beaucoup-plus-long' })).statusCode, 401)
  assert.equal((await call({ authorization: 'Bearer s3' })).statusCode, 401)
  assert.equal(count(), 0)
})

test('refuse tout si le secret n’est pas configuré', async () => {
  const { call, count } = setup('')
  assert.equal((await call({ authorization: 'Bearer ' })).statusCode, 401)
  assert.equal(count(), 0)
})

test('exécute la purge avec le bon secret', async () => {
  const { call, count } = setup()
  const res = await call({ authorization: 'Bearer s3cret' })
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body, { purged: 4 })
  assert.equal(count(), 1)
})

test('405 pour toute méthode autre que GET/POST, même avec le bon secret', async () => {
  const { call, count } = setup()
  for (const m of ['PUT', 'DELETE', 'PATCH']) assert.equal((await call({ authorization: 'Bearer s3cret' }, m)).statusCode, 405)
  assert.equal(count(), 0)
})

test('POST accepté avec le bon secret', async () => {
  const { call, count } = setup()
  assert.equal((await call({ authorization: 'Bearer s3cret' }, 'POST')).statusCode, 200)
  assert.equal(count(), 1)
})
