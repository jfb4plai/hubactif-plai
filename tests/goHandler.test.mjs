import test from 'node:test'
import assert from 'node:assert/strict'
import { createGoHandler } from '../api/_lib/goHandler.js'
import { generateKeyPair, verifyToken, TOKEN_TTL_SECONDS } from '../shared/token.js'
import { fakeReq, fakeRes } from './helpers.mjs'

const NOW = 1_800_000_000_000
const ID = 'a1b2c3d4e5f60718'
const row = { out_target: 't1', out_assignment: 'a1', out_code: 'ABCD2345', out_app_slug: 'dictee', out_deep_link: 'https://dictee.example.org/dictee/3?lang=fr' }

async function setup({ found = row, allowed = true } = {}) {
  const keys = await generateKeyPair()
  const opened = []
  const handler = createGoHandler({
    openLink: async (id) => { opened.push(id); return found },
    rateCheck: async () => allowed,
    privateKey: keys.privateKey,
    now: () => NOW,
  })
  const call = async (id) => { const res = fakeRes(); await handler(fakeReq({ method: 'GET', query: { id } }), res); return res }
  return { call, opened, keys }
}

test('lien valide : 302 vers l’app avec un jeton de 120 h, requête d’origine conservée', async () => {
  const { call, keys } = await setup()
  const res = await call(ID)
  assert.equal(res.statusCode, 302)
  const url = new URL(res.headers.location)
  assert.equal(url.origin, 'https://dictee.example.org')
  assert.equal(url.searchParams.get('lang'), 'fr')
  const payload = await verifyToken(url.searchParams.get('t'), keys.publicKey, NOW / 1000)
  assert.deepEqual(payload, { tid: 't1', aid: 'a1', code: 'ABCD2345', app: 'dictee', exp: NOW / 1000 + TOKEN_TTL_SECONDS })
  assert.equal(res.headers['cache-control'], 'no-store')
})

test('lien inconnu, révoqué ou expiré : 410 avec message lisible', async () => {
  const { call } = await setup({ found: null })
  const res = await call(ID)
  assert.equal(res.statusCode, 410)
  assert.match(res.body, /Ce lien ne marche plus/)
})

test('identifiant mal formé : 410 sans interroger la base', async () => {
  const { call, opened } = await setup()
  assert.equal((await call('../../etc')).statusCode, 410)
  assert.equal(opened.length, 0)
})

test('429 si limite de débit dépassée', async () => {
  const { call } = await setup({ allowed: false })
  assert.equal((await call(ID)).statusCode, 429)
})
