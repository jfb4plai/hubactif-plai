import test from 'node:test'
import assert from 'node:assert/strict'
import { createGoHandler } from '../api/_lib/goHandler.js'
import { generateKeyPair, verifyToken, TOKEN_TTL_SECONDS } from '../shared/token.js'
import { fakeReq, fakeRes } from './helpers.mjs'

const NOW = 1_800_000_000_000
const ID = 'a1b2c3d4e5f60718'
const row = { out_target: 't1', out_assignment: 'a1', out_code: 'ABCD2345', out_app_slug: 'dictee', out_deep_link: 'https://dictee.example.org/dictee/3?lang=fr' }

async function setup({ found = row, allowed = true, rateThrows = false } = {}) {
  const keys = await generateKeyPair()
  const opened = []
  const rates = []
  const handler = createGoHandler({
    openLink: async (id) => { opened.push(id); return found },
    rateCheck: async (key, max, win) => { if (rateThrows) throw new Error('db'); rates.push([key, max, win]); return allowed },
    privateKey: keys.privateKey,
    now: () => NOW,
  })
  const call = async (id) => { const res = fakeRes(); await handler(fakeReq({ method: 'GET', query: { id }, headers: { 'x-real-ip': '7.7.7.7' } }), res); return res }
  return { call, opened, keys, rates }
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

test('clé de débit contenant l’IP résolue', async () => {
  const { call, rates } = await setup()
  await call(ID)
  assert.deepEqual(rates, [['go:7.7.7.7', 300, 60]])
})

test('en-têtes : Referrer-Policy sur redirection et pages, nosniff sur le HTML', async () => {
  const ok = await (await setup()).call(ID)
  assert.equal(ok.headers['referrer-policy'], 'no-referrer')
  const gone = await (await setup({ found: null })).call(ID)
  assert.equal(gone.headers['referrer-policy'], 'no-referrer')
  assert.equal(gone.headers['x-content-type-options'], 'nosniff')
  const busy = await (await setup({ allowed: false })).call(ID)
  assert.equal(busy.headers['referrer-policy'], 'no-referrer')
  assert.equal(busy.headers['x-content-type-options'], 'nosniff')
})

test('deep_link stocké non http(s) : 410, pas de redirection', async () => {
  for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'ftp://x.org/a', 'pas une url']) {
    const res = await (await setup({ found: { ...row, out_deep_link: bad } })).call(ID)
    assert.equal(res.statusCode, 410)
    assert.equal(res.headers.location, undefined)
  }
})

test('rateCheck qui échoue : page BUSY en 503', async () => {
  const res = await (await setup({ rateThrows: true })).call(ID)
  assert.equal(res.statusCode, 503)
  assert.match(res.body, /Un instant/)
})

test('un paramètre t déjà présent est remplacé, pas dupliqué', async () => {
  const { call } = await setup({ found: { ...row, out_deep_link: 'https://dictee.example.org/d?t=vieux&lang=fr' } })
  const res = await call(ID)
  const url = new URL(res.headers.location)
  assert.equal(url.searchParams.getAll('t').length, 1)
  assert.notEqual(url.searchParams.get('t'), 'vieux')
})
